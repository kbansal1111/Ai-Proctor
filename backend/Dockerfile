# Use a lightweight base image
FROM python:3.10-slim

# Install system dependencies for OpenCV & MediaPipe
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libglib2.0-0 \
    libgl1-mesa-glx && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


# Set working directory inside container
WORKDIR /app

# Copy everything from your backend into the container
COPY . .

# Install Python dependencies
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Expose the Flask port
EXPOSE 5000

# Run your Flask app
CMD ["python", "app.py"]
