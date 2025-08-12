import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";

export default function Exam() {
  const examRef = useRef(null);
  const navigate = useNavigate();

  // 1. Define questions FIRST
  const questions = useMemo(() => [
        {
          questionText: 'What is the capital of France?',
          answerOptions: [
            { answerText: 'New York', isCorrect: false },
            { answerText: 'London', isCorrect: false },
            { answerText: 'Paris', isCorrect: true },
            { answerText: 'Dublin', isCorrect: false },
          ],
        },
        {
          questionText: 'Which planet is known as the Red Planet?',
          answerOptions: [
            { answerText: 'Venus', isCorrect: false },
            { answerText: 'Mars', isCorrect: true },
            { answerText: 'Jupiter', isCorrect: false },
            { answerText: 'Saturn', isCorrect: false },
          ],
        },
        {
          questionText: 'Who wrote "Romeo and Juliet"?',
          answerOptions: [
            { answerText: 'William Wordsworth', isCorrect: false },
            { answerText: 'William Shakespeare', isCorrect: true },
            { answerText: 'John Keats', isCorrect: false },
            { answerText: 'Charles Dickens', isCorrect: false },
          ],
        },
        {
          questionText: 'What is the largest mammal?',
          answerOptions: [
            { answerText: 'Elephant', isCorrect: false },
            { answerText: 'Blue Whale', isCorrect: true },
            { answerText: 'Giraffe', isCorrect: false },
            { answerText: 'Rhino', isCorrect: false },
          ],
        },
        {
          questionText: 'Which element has the chemical symbol O?',
          answerOptions: [
            { answerText: 'Gold', isCorrect: false },
            { answerText: 'Oxygen', isCorrect: true },
            { answerText: 'Osmium', isCorrect: false },
            { answerText: 'Oxide', isCorrect: false },
          ],
        },
        {
          questionText: 'What is the square root of 64?',
          answerOptions: [
            { answerText: '6', isCorrect: false },
            { answerText: '8', isCorrect: true },
            { answerText: '10', isCorrect: false },
            { answerText: '12', isCorrect: false },
          ],
        },
        {
          questionText: 'In which continent is the Sahara Desert located?',
          answerOptions: [
            { answerText: 'Asia', isCorrect: false },
            { answerText: 'Australia', isCorrect: false },
            { answerText: 'Africa', isCorrect: true },
            { answerText: 'South America', isCorrect: false },
          ],
        },
        {
          questionText: 'Which gas do plants absorb from the atmosphere?',
          answerOptions: [
            { answerText: 'Oxygen', isCorrect: false },
            { answerText: 'Carbon Dioxide', isCorrect: true },
            { answerText: 'Nitrogen', isCorrect: false },
            { answerText: 'Hydrogen', isCorrect: false },
          ],
        },
        {
          questionText: 'Who was the first person to walk on the Moon?',
          answerOptions: [
            { answerText: 'Buzz Aldrin', isCorrect: false },
            { answerText: 'Yuri Gagarin', isCorrect: false },
            { answerText: 'Neil Armstrong', isCorrect: true },
            { answerText: 'Michael Collins', isCorrect: false },
          ],
        },
        {
          questionText: 'Which language is primarily spoken in Brazil?',
          answerOptions: [
            { answerText: 'Spanish', isCorrect: false },
            { answerText: 'French', isCorrect: false },
            { answerText: 'Portuguese', isCorrect: true },
            { answerText: 'English', isCorrect: false },
          ],
        },
      ], []);

  // 2. Now you can use questions in your hooks
  const [userAnswers, setUserAnswers] = useState(Array(questions.length).fill(null));
  const [score, setScore] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [headAlert, setHeadAlert] = useState("");
  const webcamRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [objectDetectionStatus, setObjectDetectionStatus] = useState("");

  // Memoized handleSubmit to avoid useEffect warning
  const handleSubmit = useCallback(() => {
        let newScore = 0;
        userAnswers.forEach((ansIdx, qIdx) => {
            if (
                ansIdx !== null &&
                questions[qIdx].answerOptions[ansIdx].isCorrect
            ) {
                newScore += 1;
            }
        });
        setScore(newScore);
        setSubmitted(true);
    }, [userAnswers, questions]);

  const handleStartExam = async () => {
    setRegisterError("");
    setRegistering(true);
    const face = webcamRef.current.getScreenshot();
    if (!face) {
      setRegisterError("Could not capture image from webcam.");
      setRegistering(false);
      return;
    }

    // Convert dataURL to Blob
    const blob = await fetch(face).then(res => res.blob());
    const formData = new FormData();
    formData.append("roll_number", rollNumber);
    formData.append("image", blob, "face.jpg");

    // Register face "http://127.0.0.1:5000/register-face"
    const res = await fetch("http://127.0.0.1:5000/register-face", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (data.status === "registered") {
      if (examRef.current && document.fullscreenEnabled) {
        await examRef.current.requestFullscreen();
      }
      setStarted(true);
    } else if (data.status === "no_face") {
      setRegisterError("No face detected. Please ensure your face is visible and try again.");
    } else if (data.status === "multiple_faces") {
      setRegisterError("Multiple faces detected. Please ensure only you are visible and try again.");
    } else if (data.status === "poor_quality") {
      setRegisterError(`Face image quality issue: ${data.message}. Please ensure good lighting and a clear view of your face.`);
    } else {
      setRegisterError("Face registration failed. Please try again.");
    }
    setRegistering(false);
  };

  // Now useEffect can safely use handleSubmit
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement && started && !submitted) {
        handleSubmit();
        alert("You exited fullscreen. Exam submitted automatically.");
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [started, submitted, handleSubmit]);

  const rollNumber = localStorage.getItem("rollNumber");

  const verifyFaceDuringExam = useCallback(async (dataUrl) => {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("roll_number", rollNumber);
      formData.append("image", blob, "frame.jpg");

      const res = await fetch("http://127.0.0.1:5000/verify-face", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "mismatch") {
        // Add a warning first instead of immediately submitting
        const shouldSubmit = window.confirm(
          "⚠️ Face mismatch detected! This might be due to lighting or angle changes. " +
          "Please ensure you are the same person who registered. " +
          "Click OK to submit the exam, or Cancel to continue."
        );
        if (shouldSubmit) {
          handleSubmit();
        }
      } else if (data.status === "multiple_faces") {
        alert("Multiple faces detected! Please ensure only you are visible.");
      } else if (data.status === "no_face") {
        // Don't submit for no face detection, just warn
        console.log("No face detected in current frame");
      }
    } catch (error) {
      console.error("Face verification error:", error);
      // Don't submit on network errors
    }
  }, [rollNumber, handleSubmit]);

  const detectObjectDuringExam = useCallback(async (dataUrl) => {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      const res = await fetch("http://127.0.0.1:5000/detect-object", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setObjectDetectionStatus(`Last check: ${data.status}`);

      if (data.status === "forbidden_object") {
        alert(`Forbidden object detected: ${data.objects?.join(', ')}. Exam will be submitted.`);
        handleSubmit();
      }
    } catch (error) {
      console.error("Object detection error:", error);
    }
  }, [handleSubmit]);

  const sendFrameToBackend = useCallback((dataUrl) => {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');
        fetch("http://127.0.0.1:5000/detect-head", {
          method: "POST",
          body: formData,
        })
        .then(res => res.json())
        .then(data => {
          setHeadAlert(data.direction);
          if (data.direction.startsWith("ALERT")) {
            const alertData = {
              student_id: rollNumber,
              direction: data.direction,
              time: new Date().toLocaleTimeString()
            };
            fetch("http://127.0.0.1:5000/log-alert", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alertData)
            });
          }
        });
      });
  }, [rollNumber]);

  // Timer logic
  useEffect(() => {
      if (!submitted && timeLeft > 0) {
          const timer = setTimeout(() => {
              setTimeLeft(timeLeft - 1);
          }, 1000);
          return () => clearTimeout(timer);
      }
      if (timeLeft === 0 && !submitted) {
          handleSubmit();
      }
  }, [timeLeft, submitted, handleSubmit]);

  // Head movement detection logic
  useEffect(() => {
      if (!started || submitted) return;
      const interval = setInterval(() => {
          if (webcamRef.current) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                  sendFrameToBackend(imageSrc);
              }
          }
      }, 2000);
      return () => clearInterval(interval);
  }, [started, submitted, sendFrameToBackend]);

  // Face verification logic (separate from head movement, less frequent)
  useEffect(() => {
      if (!started || submitted) return;
      const interval = setInterval(() => {
          if (webcamRef.current) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                  verifyFaceDuringExam(imageSrc);
              }
          }
      }, 2000); // Reduced from 3000ms to 2000ms for better face verification
      return () => clearInterval(interval);
  }, [started, submitted, verifyFaceDuringExam]);

  // Object detection logic
  useEffect(() => {
      if (!started || submitted) return;
      const interval = setInterval(() => {
          if (webcamRef.current) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                  detectObjectDuringExam(imageSrc);
              }
          }
      }, 1500); // Reduced from 3000ms to 1500ms for faster object detection
      return () => clearInterval(interval);
  }, [started, submitted, detectObjectDuringExam]);

  // Disable copy/paste functionality during exam
  useEffect(() => {
    const handleCopyPaste = (e) => {
      e.preventDefault();
      alert("Copy/paste is disabled during the exam!");
    };

    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  }, []);

  // Disable tab switching during exam
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && started && !submitted) {
        alert("⚠️ Tab switching is not allowed during the exam! Returning to exam.");
        // Force focus back to the exam tab
        window.focus();
      }
    };

    const handleBeforeUnload = (e) => {
      if (started && !submitted) {
        e.preventDefault();
        e.returnValue = "⚠️ You cannot leave the exam page!";
        return "⚠️ You cannot leave the exam page!";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [started, submitted]);



  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={examRef} style={{ 
      backgroundColor: '#f8f9fa', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header Warning */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '2px solid #ffeaa7',
        color: '#856404',
        padding: '15px',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: '20px'
      }}>
        ⚠️ Do not exit fullscreen mode. You are being monitored by AI proctoring.
      </div>

      {!started ? (
        // Pre-exam setup
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '70vh',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h1 style={{
              color: '#2c3e50',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              marginBottom: '30px'
            }}>
              📝 Online Examination
            </h1>
            
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              style={{
                borderRadius: '15px',
                border: '3px solid #e9ecef',
                marginBottom: '20px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
              }}
            />
            
            {registerError && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '20px',
                border: '1px solid #f5c6cb'
              }}>
                ⚠️ {registerError}
              </div>
            )}
            
            <button 
              onClick={handleStartExam} 
              disabled={registering}
              style={{
                backgroundColor: registering ? '#95a5a6' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '10px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: registering ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)'
              }}
            >
              {registering ? "🔄 Registering..." : "🚀 Start Exam"}
            </button>
          </div>
        </div>
      ) : (
        // Exam interface
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
          {/* Left: Questions */}
          <div style={{
            flex: '2',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '15px',
            margin: '0 10px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            overflowY: 'auto'
          }}>
            {/* Timer and Progress */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              padding: '20px',
              backgroundColor: '#e3f2fd',
              borderRadius: '10px',
              border: '2px solid #2196f3'
            }}>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: timeLeft < 60 ? '#f44336' : '#1976d2'
              }}>
                ⏰ Time Left: {formatTime(timeLeft)}
              </div>
              <div style={{
                backgroundColor: '#ff9800',
                color: 'white',
                padding: '8px 15px',
                borderRadius: '20px',
                fontWeight: 'bold'
              }}>
                📄 Question {currentQuestionIndex + 1} of {questions.length}
              </div>
            </div>

            {!submitted ? (
              <>
                {/* Current Question */}
                <div style={{
                  backgroundColor: '#fafafa',
                  padding: '30px',
                  borderRadius: '15px',
                  border: '2px solid #e0e0e0',
                  marginBottom: '30px'
                }}>
                  <h3 style={{
                    color: '#2c3e50',
                    fontSize: '1.3rem',
                    marginBottom: '25px',
                    fontWeight: '600'
                  }}>
                    ❓ {questions[currentQuestionIndex].questionText}
                  </h3>
                  
                  {questions[currentQuestionIndex].answerOptions.map((option, oIdx) => (
                    <div key={oIdx} style={{ marginBottom: '15px' }}>
                      <input
                        type="radio"
                        id={`q${currentQuestionIndex}-o${oIdx}`}
                        name={`question-${currentQuestionIndex}`}
                        value={oIdx}
                        checked={userAnswers[currentQuestionIndex] === oIdx}
                        onChange={() => {
                          const updated = [...userAnswers];
                          updated[currentQuestionIndex] = oIdx;
                          setUserAnswers(updated);
                        }}
                        style={{
                          marginRight: '12px',
                          transform: 'scale(1.2)'
                        }}
                      />
                      <label 
                        htmlFor={`q${currentQuestionIndex}-o${oIdx}`}
                        style={{
                          color: '#34495e',
                          fontSize: '1.1rem',
                          cursor: 'pointer',
                          padding: '10px 15px',
                          borderRadius: '8px',
                          backgroundColor: userAnswers[currentQuestionIndex] === oIdx ? '#e8f5e8' : 'transparent',
                          border: userAnswers[currentQuestionIndex] === oIdx ? '2px solid #4caf50' : '1px solid #ddd',
                          transition: 'all 0.3s ease',
                          display: 'inline-block',
                          minWidth: '200px'
                        }}
                      >
                        {option.answerText}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '30px'
                }}>
                  <button 
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    style={{
                      backgroundColor: currentQuestionIndex === 0 ? '#95a5a6' : '#17a2b8',
                      color: 'white',
                      border: 'none',
                      padding: '12px 25px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ⬅️ Previous
                  </button>
                  
                  <span style={{
                    backgroundColor: '#6f42c1',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    fontWeight: 'bold'
                  }}>
                    📄 {currentQuestionIndex + 1} / {questions.length}
                  </span>
                  
                  <button 
                    onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    disabled={currentQuestionIndex === questions.length - 1}
                    style={{
                      backgroundColor: currentQuestionIndex === questions.length - 1 ? '#95a5a6' : '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '12px 25px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: currentQuestionIndex === questions.length - 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next ➡️
                  </button>
                </div>

                {/* Submit Button */}
                {currentQuestionIndex === questions.length - 1 && (
                  <button 
                    onClick={handleSubmit}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '15px 30px',
                      borderRadius: '10px',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 5px 15px rgba(220, 53, 69, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    🎯 Submit Exam
                  </button>
                )}
              </>
            ) : (
              // Results
              <div style={{
                textAlign: 'center',
                padding: '40px',
                backgroundColor: '#e8f5e8',
                borderRadius: '15px',
                border: '3px solid #4caf50'
              }}>
                <h2 style={{
                  color: '#2e7d32',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}>
                  🎉 Exam Completed!
                </h2>
                <div style={{
                  fontSize: '2rem',
                  color: '#1976d2',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}>
                  Your Score: <span style={{ color: '#4caf50', fontSize: '3rem' }}>{score}</span> / <span style={{ color: '#ff9800' }}>{questions.length}</span>
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  color: '#666',
                  marginBottom: '30px'
                }}>
                  Percentage: <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{Math.round((score / questions.length) * 100)}%</span>
                </div>
                <button 
                  onClick={() => navigate('/proctor-dashboard')}
                  style={{
                    backgroundColor: '#6f42c1',
                    color: 'white',
                    border: 'none',
                    padding: '15px 30px',
                    borderRadius: '10px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📊 Go to Proctor Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Right: Webcam and Alerts */}
          <div style={{
            flex: '1',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '15px',
            margin: '0 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: '#2c3e50',
              color: 'white',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: 'bold',
              width: '100%'
            }}>
              📹 AI Proctoring Active
            </div>
            
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              style={{
                borderRadius: '15px',
                border: '3px solid #e9ecef',
                marginBottom: '20px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
              }}
            />
            
            {headAlert && (
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: headAlert.startsWith("ALERT") ? "#dc3545" : "#28a745",
                textAlign: 'center',
                padding: '15px',
                borderRadius: '10px',
                backgroundColor: headAlert.startsWith("ALERT") ? '#f8d7da' : '#d4edda',
                border: `2px solid ${headAlert.startsWith("ALERT") ? '#f5c6cb' : '#c3e6cb'}`,
                marginBottom: '15px',
                width: '100%'
              }}>
                {headAlert.startsWith("ALERT") ? "🚨 " : "✅ "}{headAlert}
              </div>
            )}
            
            {objectDetectionStatus && (
              <div style={{
                fontSize: '1rem',
                color: '#6c757d',
                textAlign: 'center',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                width: '100%'
              }}>
                🔍 {objectDetectionStatus}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}