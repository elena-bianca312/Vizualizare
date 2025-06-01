import numpy as np
import requests
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import io
import matplotlib.pyplot as plt
from data_loader import load_sensor_data

debug = True
# Load data
csv_file = "bucharest_sensor_data_with_location2.csv"

# Flask app setup
app = Flask(__name__)
CORS(app)  # Enable CORS so frontend (Vite) can call Flask

sensor_colors = {
    'temperature': 'red',
    'humidity': 'blue',
    'light': 'gold',
    'sound': 'violet',
    'motion': 'orange',
    'pressure': 'green'
}

API_BASE_URL = "http://localhost:8080/api/v1/sensor-data"

def fetch_sensor_data():
    if debug:
        print("Debug mode: Loading data from CSV")
        df = pd.read_csv(csv_file)
    else:
        print("Fetching data from API")
        response = requests.get(API_BASE_URL)
        response.raise_for_status()
        data = response.json()
        df = pd.DataFrame(data)

    if 'floor' not in df.columns:
        df['floor'] = 1
    else:
        df['floor'] = df['floor'].fillna(1)

    return df

@app.route('/all_sensors')
def get_all_sensors():
    try:
        df = fetch_sensor_data()
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.replace({np.nan: None})
        return jsonify(df.to_dict(orient='records'))
    except Exception as e:
        return jsonify({"error": "Failed to fetch data", "details": str(e)}), 500

@app.route('/get_markers')
def get_markers():
    date_str = request.args.get('date')
    hour_str = request.args.get('hour')
    try:
        selected_date = pd.to_datetime(date_str).date()
        selected_hour = int(hour_str)
        df = fetch_sensor_data()
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    except Exception as e:
        return jsonify({"error": "Invalid date or hour", "details": str(e)}), 400

    filtered_data = df[
        (df['timestamp'].dt.date == selected_date) &
        (df['timestamp'].dt.hour == selected_hour)
    ]

    normalization_ranges = {
        'temperature': (-10, 50),
        'humidity': (20, 100),
        'light': (0, 1000),
        'sound': (10, 120),
        'motion': (0, 1),
        'pressure': (950, 1050)
    }

    def normalize(value, min_val, max_val):
        try:
            return max(0.0, min(1.0, (float(value) - min_val) / (max_val - min_val)))
        except:
            return 0.0  # fallback in case of bad data

    markers = []
    for _, sensor in filtered_data.iterrows():
        sensor_type = sensor['sensor_type']
        min_val, max_val = normalization_ranges.get(sensor_type, (0, 1))
        normalized_value = normalize(sensor['value'], min_val, max_val)

        color = sensor_colors.get(sensor['sensor_type'], 'grey')
        marker = {
            "latitude": sensor['latitude'],
            "longitude": sensor['longitude'],
            "popup": (
                f"<b>Senzor ID:</b> {sensor['device_id']}<br>"
                f"<b>Tip:</b> {sensor['sensor_type']}<br>"
                f"<b>Valoare:</b> {sensor['value']} {sensor['unit']}<br>"
                f"<a href='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={sensor['latitude']},{sensor['longitude']}' target='_blank'>Street View</a><br>"
                f"<a href='/download_daily_graph?device_id={sensor['device_id']}&date={sensor['timestamp'].date()}' target='_blank'>Download Graph</a>"
            ),
            "sensor_type": sensor['sensor_type'],
            "value": normalized_value ,
            "color": color
        }
        markers.append(marker)

    return jsonify(markers)

@app.route('/download_daily_graph')
def download_daily_graph():
    device_id = request.args.get('device_id')
    date_str = request.args.get('date')
    if not device_id or not date_str:
        return "Missing device_id or date", 400

    try:
        selected_date = pd.to_datetime(date_str).date()
    except Exception as e:
        return f"Invalid date: {str(e)}", 400

    df = fetch_sensor_data()
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')

    filtered_data = df[
        (df['device_id'] == device_id) &
        (df['timestamp'].dt.date == selected_date)
    ]

    if filtered_data.empty:
        return f"No data available for sensor {device_id} on {date_str}", 404

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(filtered_data['timestamp'], filtered_data['value'], marker='o', linestyle='-')
    ax.set_title(f"Sensor {device_id} on {date_str}")
    ax.set_xlabel("Time")
    ax.set_ylabel("Value")
    ax.legend()
    fig.autofmt_xdate()

    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close(fig)
    buf.seek(0)

    return send_file(
        buf,
        mimetype='image/png',
        as_attachment=True,
        download_name=f"{device_id}_{date_str}.png"
    )

# def fetch_and_save_sensor_data(api_url, output_csv_path):
#     try:
#         print("ssss")
#         response = requests.get(api_url)
#         response.raise_for_status()
#
#         data = response.json()
#
#         df = pd.DataFrame(data)
#         required_columns = [
#             'timestamp', 'location', 'device_id', 'sensor_type', 'value',
#             'unit', 'latitude', 'longitude', 'is_indoor', 'floor'
#         ]
#
#         for col in required_columns:
#             if col not in df.columns:
#                 df[col] = None
#
#         df = df[required_columns]
#         df.to_csv(output_csv_path, index=False)
#         print(f"Data saved to {output_csv_path}")
#
#     except Exception as e:
#         print(f"Failed to fetch or save data: {e}")

if __name__ == '__main__':
    app.run(debug=True, port=8051)

    # fetch_and_save_sensor_data(
    #     "http://localhost:8080/api/v1/sensor-data",
    #     "output_sensor_data.csv"
    # )