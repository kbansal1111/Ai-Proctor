from flask import Flask, jsonify, request
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import torch
import psycopg2
import os
from datetime import datetime
import json
import gdown

app = Flask(__name__)
CORS(app)

# PostgreSQL Database Configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'ai_proctor_db',
    'user': 'postgres',
    'password': '1234',
    'port': '5432'
}

# In-memory storage for registered faces only
registered_faces = set()  # Just store roll numbers that registered

# Load YOLOv5 model (do this once at startup)
model = torch.hub.load('ultralytics/yolov5', 'custom', path='yolov5m.pt', source='github')

MODEL_PATH = "yolov5m.pt"
GDRIVE_ID = "1IdrDaiM5xiK0P8-5FOFfhgS-oKyQNrFp"
GDRIVE_URL = f"https://drive.google.com/uc?id={GDRIVE_ID}"

if not os.path.exists(MODEL_PATH):
    print("Downloading YOLOv5m model from Google Drive...")
    gdown.download(GDRIVE_URL, MODEL_PATH, quiet=False)

def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def init_database():
    """Check database connection and existing tables"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            
            # Check if student table exists and has data
            cursor.execute("SELECT COUNT(*) FROM student")
            student_count = cursor.fetchone()[0]
            
            # Check if alerts table exists
            cursor.execute("SELECT COUNT(*) FROM alerts")
            alerts_count = cursor.fetchone()[0]
            
            cursor.close()
            conn.close()
            
            print(f"Database connection successful!")
            print(f"Student table has {student_count} records")
            print(f"Alerts table has {alerts_count} records")
            print("Using existing database tables and data.")
            
        except Exception as e:
            print(f"Database check error: {e}")
            print("Please ensure your database tables exist and are accessible.")
    else:
        print("Failed to connect to database. Please check your database configuration.")

@app.route('/log-alert', methods=['POST'])
def log_alert():
    data = request.get_json()
    student_id = data.get('student_id')
    direction = data.get('direction')
    time = data.get('time')
    
    if student_id and direction and time:
        # Store in database only
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO alerts (student_id, direction, alert_time, details)
                    VALUES (%s, %s, %s, %s)
                """, (student_id, direction, datetime.now(), json.dumps(data)))
                conn.commit()
                cursor.close()
                conn.close()
                return jsonify({'status': 'ok'})
            except Exception as e:
                print(f"Database logging error: {e}")
                return jsonify({'status': 'error', 'message': 'Database error'}), 500
        else:
            return jsonify({'status': 'error', 'message': 'Database connection failed'}), 500
    return jsonify({'status': 'error', 'message': 'Missing data'}), 400

@app.route('/alerts', methods=['GET'])
def get_alerts():
    # Fetch alerts from database instead of memory
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT student_id, direction, alert_time, details 
                FROM alerts 
                ORDER BY alert_time DESC
            """)
            
            alerts = []
            for row in cursor.fetchall():
                alerts.append({
                    'student_id': row[0],
                    'direction': row[1],
                    'alert_time': row[2].isoformat() if row[2] else None,
                    'details': row[3] if row[3] else {}
                })
            
            cursor.close()
            conn.close()
            return jsonify(alerts)
        except Exception as e:
            print(f"Database fetch error: {e}")
            cursor.close()
            conn.close()
            return jsonify({'error': 'Database error'}), 500
    else:
        return jsonify({'error': 'Database connection failed'}), 500

@app.route('/registered-faces', methods=['GET'])
def get_registered_faces():
    return jsonify({'registered_faces': list(registered_faces)})

@app.route('/test-head-detection', methods=['GET'])
def test_head_detection():
    """Test endpoint to check if head detection is working"""
    return jsonify({
        'status': 'Head detection system is running',
        'face_mesh_initialized': face_mesh is not None,
        'registered_faces_count': len(registered_faces),
        'registered_faces': list(registered_faces)
    })

@app.route('/simple-head-detection', methods=['POST'])
def simple_head_detection():
    """Simplified head detection using basic face detection"""
    try:
        file = request.files['image']
        npimg = np.frombuffer(file.read(), np.uint8)
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'direction': 'No face detected', 'yaw': 0, 'pitch': 0, 'roll': 0})
        
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Use face detection instead of face mesh for better performance
        results = face_detection.process(rgb)
        
        direction = "No face detected"
        yaw, pitch, roll = 0, 0, 0

        if results.detections:
            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            
            # Calculate face center
            face_center_x = bbox.xmin + bbox.width / 2
            face_center_y = bbox.ymin + bbox.height / 2
            
            # Simple thresholds based on face position
            if face_center_x < 0.3:  # Face on left side
                direction = "ALERT: Looking Left"
                yaw = -30
            elif face_center_x > 0.7:  # Face on right side
                direction = "ALERT: Looking Right"
                yaw = 30
            elif face_center_y < 0.3:  # Face on top
                direction = "ALERT: Looking Up"
                pitch = -20
            elif face_center_y > 0.7:  # Face on bottom
                direction = "ALERT: Looking Down"
                pitch = 20
            else:
                direction = "Looking Forward"
                yaw, pitch, roll = 0, 0, 0
            
            print(f"Simple head detection - Face center: ({face_center_x:.2f}, {face_center_y:.2f}), Direction: {direction}")
        
        return jsonify({'direction': direction, 'yaw': float(yaw), 'pitch': float(pitch), 'roll': float(roll)})
        
    except Exception as e:
        print(f"Simple head detection error: {e}")
        return jsonify({'direction': f'Error: {str(e)}', 'yaw': 0, 'pitch': 0, 'roll': 0})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"message": "No JSON data received"}), 400
    
    username = data.get('username')
    rollNumber = data.get('rollNumber')
    password = data.get('password')

    # Query the student table in PostgreSQL database
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM student 
                WHERE username = %s AND roll_number = %s AND password = %s
            """, (username, rollNumber, password))
            
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if user:
                return jsonify({"message": "Login successful"})
            else:
                return jsonify({"message": "Invalid credentials"})
        except Exception as e:
            print(f"Database login error: {e}")
            conn.close()
            return jsonify({"message": "Database error occurred"}), 500
    else:
        return jsonify({"message": "Database connection failed"}), 500

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)
model_points = np.array([
    (0.0, 0.0, 0.0),          # Nose tip
    (0.0, -330.0, -65.0),     # Chin
    (-225.0, 170.0, -135.0),  # Left eye left corner
    (225.0, 170.0, -135.0),   # Right eye right corner
    (-150.0, -150.0, -125.0), # Left mouth corner
    (150.0, -150.0, -125.0)   # Right mouth corner
], dtype=np.float64)
landmark_ids = [1, 152, 263, 33, 287, 57]
YAW_THRESHOLD, PITCH_THRESHOLD, ROLL_THRESHOLD = 30, 20, 30

@app.route('/detect-head', methods=['POST'])
def detect_head():
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)
    direction, yaw, pitch, roll = "No face detected", 0, 0, 0

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0]
        image_points = []
        for idx in landmark_ids:
            pt = face_landmarks.landmark[idx]
            x, y = int(pt.x * w), int(pt.y * h)
            image_points.append((x, y))
        image_points = np.array(image_points, dtype=np.float64)
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1))
        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs)
        rmat, _ = cv2.Rodrigues(rotation_vector)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        pitch, yaw, roll = angles
        direction = "Looking Forward"
        if yaw > YAW_THRESHOLD:
            direction = "ALERT: Looking Right"
        elif yaw < -YAW_THRESHOLD:
            direction = "ALERT: Looking Left"
        elif pitch > PITCH_THRESHOLD:
            direction = "ALERT: Looking Down"
        elif pitch < -PITCH_THRESHOLD:
            direction = "ALERT: Looking Up"
        elif abs(roll) > ROLL_THRESHOLD:
            direction = "ALERT: Tilting Head"

    return jsonify({'direction': direction, 'yaw': float(yaw), 'pitch': float(pitch), 'roll': float(roll)})

mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)

@app.route('/register-face', methods=['POST'])
def register_face():
    roll_number = request.form['roll_number']
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({'status': 'no_face'})
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    if rgb is None or rgb.size == 0:
        return jsonify({'status': 'no_face'})
    results = face_detection.process(rgb)
    if results.detections:
        if len(results.detections) == 1:
            registered_faces.add(roll_number)
            return jsonify({'status': 'registered'})
        else:
            return jsonify({'status': 'multiple_faces'})
    else:
        return jsonify({'status': 'no_face'})

@app.route('/verify-face', methods=['POST'])
def verify_face():
    roll_number = request.form['roll_number']
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_detection.process(rgb)
    if not results.detections:
        return jsonify({'status': 'no_face'})
    elif len(results.detections) > 1:
        return jsonify({'status': 'multiple_faces'})
    else:
        # For true recognition, you need a face embedding model.
        # Here, we just check that a face is present and the student is registered.
        if roll_number in registered_faces:
            return jsonify({'status': 'match'})
        else:
            return jsonify({'status': 'mismatch'})

@app.route('/detect-object', methods=['POST'])
def detect_object():
    file = request.files['image']
    npimg = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = model(rgb)
    df = results.pandas().xyxy[0]

    # Increase confidence threshold to reduce false positives
    df = df[df['confidence'] > 0.5]
    labels = df['name'].tolist()
    print("Detected labels (conf > 0.5):", labels)  # Debug: see what YOLOv5 returns

    # Only check for 'cell phone' and 'laptop'
    forbidden = {'cell phone', 'laptop'}
    detected = [label for label in labels if label in forbidden]

    if detected:
        return jsonify({'status': 'forbidden_object', 'objects': detected})
    else:
        return jsonify({'status': 'clear'})

if __name__ == "__main__":
    # Initialize database tables
    init_database()
    app.run(debug=True)