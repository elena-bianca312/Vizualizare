# University Campus 2D+3D Visualization with Sensor Data
# Elena Dumitru & Radu Fetcu

## Project Overview
This project provides a 2D and 3D visualization of a university campus, offering real-time data on environmental conditions such as temperature, humidity, air quality, and wind speed. Users can explore sensor data at various levels of detail, including specific floors and rooms within campus buildings.

The project consists of a Python-based backend and a modern JavaScript frontend, using Vite as a bundler to enhance development efficiency and manage dependencies.

---

## Features
- Interactive 2D and 3D visualization of the campus.
- Real-time sensor data for temperature, humidity, air quality, and wind speed.
- Detailed data access at floor and room levels.
- Modern web interface for an intuitive user experience.

---

## Prerequisites
Ensure you have the following installed:
- **Python** (version ??)
- **Node.js** (version ??)
- **npm** (comes with Node.js)

---

## How to Run the Project

### Backend Setup
0. Create Python virtual environment:
     ```
     python -m venv venv
     ```
1. Activate the Python virtual environment:
- On Windows:
     ```
     venv\Scripts\activate
     ```
2. From the main project folder, start the backend by running:
     ```
     python app.py
     ```
3. The backend will now be accessible at the specified port (default: [http://localhost:8051/](http://localhost:8051/)).

### Frontend Setup
1. Navigate to the frontend folder:
     ```
     cd my-3d-map
     ```
2. (First time running the project) Add dependencies for Vite
     ```
     npm install
     ```
3. Start the development server using Vite:
     ```
     npm run dev
     ```
4. Open your browser and go to the specified port (default: [http://localhost:5173/](http://localhost:5173/)).

---

## About Vite
[Vite](https://vitejs.dev/) is a modern frontend build tool designed for fast development and optimized production builds. It uses native ES modules during development to enable lightning-fast hot module replacement (HMR). 

In this project, Vite is used to bundle static assets and manage dependencies for the frontend. Some libraries that could not be dynamically imported were downloaded as stable versions and included statically in the project using Vite.

---

## Folder Structure
     project-root/
    ├── app.py # Backend entry point
    ├── venv/ # Python virtual environment
    ├── my-3d-map/ # Frontend folder (contains Vite setup)
    │ ├── src/ # Source code for the frontend
    │ ├── package.json # npm dependencies for the frontend
    │ └── ... # Other frontend files
    └── README.md # Project documentation (this file)
