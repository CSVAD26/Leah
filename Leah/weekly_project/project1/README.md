# Unravel

An interactive audio-visual canvas that translates physical gestures and vocal frequencies into responsive digital geometry.

---

## Intention

Drawing is an intuitive behavior that humans possess instinctively. Drawing creates spaces to explore and express. While drawing creates artifacts with a medium, the act of drawing itself also carries meaning for us, whether it is for documentation, expression, or deconstructing reality. 

The core impulse behind drawing is rather simple. Here, I want to recreate the very first feeling we all had as kids with a colored pen: playfulness that leads us into our imagination. The intention for this project is to make an interactive drawing tool that recreates this sense of playfulness and exploration. 

The name **"Unravel"** reflects the core concept of unpacking and releasing invisible signals into physical space. Just as a single thread is pulled from a spool to weave a complex pattern, *Unravel* takes the unseen signals of sound and physical gestures and unwinds them outward into visible forms.

---

## Ideation

Everything is a signal. Sound and light share the same fundamental architecture, differing only in frequency.

As I recently was learning media signal processing, I came across different ways of exploring how time-domain waveforms can be transformed into different domains. The Fast Fourier Transform (FFT) acts as the mathematical bridge, converting raw temporal audio samples into the frequency domain, which helps us discover certain properties in a signal that are not intuitive to figure out in the time domain.

This project leverages that transformation. By isolating a specific structural window, which is the octave spanning from $C_4$ to $C_5$, we map musical pitches and vocal vibrations straight into dynamic harmonic structures and the visible color spectrum. In this simplified transformation, frequency bins become hue, and amplitude becomes line weight and motion. Through this mapping, audio is visualized into spatial geometry.

---

## Technical Approach

The technical architecture coordinates these systems through explicit, parallel layers:

* **FFT Spectral Analysis:** Converts raw time-domain waveforms into frequency bins, allowing the code to read underlying spectral components rather than just raw volume.
* **Bandpass Filtering:** Isolates a precise structural octave window, spanning from $C_4$ ($261.63\text{ Hz}$) to $C_5$ ($523.25\text{ Hz}$), to focus on musical pitches and vocal frequencies. Specific frequencies where there are harmonics create a uniform color, resembling harmonic waveforms.
* **Audio-Driven Geometry:** Maps frequency bins and amplitude directly into dynamic harmonic structures, particle behaviors, and visual hues.
* **OpenCV Hand Tracking:** Processes live webcam frames in real time, detecting hand contours, center points, and bounding box dimensions.
* **Kalman Filter Smoothing:** Paired with OpenCV hand tracking to solve noisy input. It filters out tracking jitter and stabilizes coordinate trajectories.

---

## Outcome & Reflections

The project bridges invisible signals by transforming audio frequencies into a responsive visual experience.

* **The Artifact as Process:** By integrating native screen and audio recording capabilities, the final output is not just a static image, but a complete temporal documentation of performance and sound.
* **Reflections on Technical Challenges:** Navigating the intersection of real-time computer vision and audio processing required balancing asynchronous systems. I learned that throttling OpenCV frame processing to alternate cycles and engineering an offscreen graphics buffer (`trailBuffer`) were critical technical breakthroughs to maintain a fluid 60fps render loop without performance lag.
* **Connecting Intention to Signal Processing:** Diving into media signal processing and the Fast Fourier Transform (FFT) fulfilled my core intention to visualize audio signals. Transforming abstract mathematical data into expressive form proved that technical signal analysis can serve as a deeply intuitive creative medium.
* **An Alternative and Educational Playground:** Ultimately, the tool revives that early childhood impulse of playing with marks and color. It enables us to explore a simplified relationship between visual light and audio frequency in an intuitive way.