//smooth out noisy input with Kalman filter
class KalmanFilter2D {
  constructor(processNoise = 1e-4, measurementNoise = 1e-1) {
    this.q = processNoise;       // Process noise covariance (trust in model)
    this.r = measurementNoise;   // Measurement noise covariance (trust in sensor)
    
    this.x = 0;                  // Estimated X
    this.y = 0;                  // Estimated Y
    this.p = 1;                  // Estimation error covariance
    this.k = 0;                  // Kalman gain
    
    this.initialized = false;
  }

  update(measX, measY) {
    if (!this.initialized) {
      this.x = measX;
      this.y = measY;
      this.initialized = true;
      return { x: this.x, y: this.y };
    }

    // 1. Prediction Update
    this.p = this.p + this.q;

    // 2. Measurement Update (Calculation of Kalman Gain)
    this.k = this.p / (this.p + this.r);
    
    // 3. Correct estimate with new measurement
    this.x = this.x + this.k * (measX - this.x);
    this.y = this.y + this.k * (measY - this.y);
    
    // 4. Update error covariance
    this.p = (1 - this.k) * this.p;

    return { x: this.x, y: this.y };
  }
}