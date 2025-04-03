import dash
from dash import html
import flask
from flask import request, jsonify, render_template, send_file
import pandas as pd
from data_loader import load_sensor_data
import io
import matplotlib.pyplot as plt

csv_file = "bucharest_sensor_data_with_location.csv"
df = load_sensor_data(csv_file)

server = flask.Flask(__name__, static_folder='assets')

app = dash.Dash(__name__, server=server, url_base_pathname='/dash/', suppress_callback_exceptions=True)
app.layout = html.Div()

sensor_colors = {
    'temperature': 'red',
    'humidity': 'blue',
    'air_quality': 'green',
    'wind_speed': 'violet'
}

@server.route('/')
def index():
    default_date = df['timestamp'].min().date().isoformat()
    default_hour = 12
    return render_template('index.html', default_date=default_date, default_hour=default_hour)

@server.route('/download_daily_graph')
def download_daily_graph():
    sensor_id = request.args.get('sensor_id')
    date_str = request.args.get('date')
    if not sensor_id or not date_str:
        return "Missing sensor_id or date", 400

    try:
        selected_date = pd.to_datetime(date_str).date()
    except Exception as e:
        return f"Invalid date: {str(e)}", 400

    filtered_data = df[
        (df['sensor_id'] == sensor_id) &
        (df['timestamp'].dt.date == selected_date)
    ]

    if filtered_data.empty:
        return f"No data available for sensor {sensor_id} on {date_str}", 404

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(filtered_data['timestamp'], filtered_data['value'],
            marker='o', linestyle='-', label='Value')
    ax.set_title(f"Daily Graph for Sensor {sensor_id} on {date_str}")
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
        download_name=f"{sensor_id}_{date_str}.png"
    )
@server.route('/get_markers')
def get_markers():
    date_str = request.args.get('date')
    hour_str = request.args.get('hour')
    try:
        selected_date = pd.to_datetime(date_str).date()
        selected_hour = int(hour_str)
    except Exception as e:
        return jsonify({"error": "Invalid date or hour", "details": str(e)}), 400

    filtered_data = df[
        (df['timestamp'].dt.date == selected_date) &
        (df['timestamp'].dt.hour == selected_hour)
    ]
    markers = []
    for _, sensor in filtered_data.iterrows():
        color = sensor_colors.get(sensor['sensor_type'], 'gray')
        marker = {
            "lat": sensor['lat'],
            "lon": sensor['lon'],
            "popup": (
                f"<b>Senzor ID:</b> {sensor['sensor_id']}<br>"
                f"<b>Tip:</b> {sensor['sensor_type']}<br>"
                f"<b>Valoare:</b> {sensor['value']} {sensor['unit']}<br>"
                f"<a href='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={sensor['lat']},{sensor['lon']}' target='_blank'>View Street View</a><br>"
                f"<a href='/download_daily_graph?sensor_id={sensor['sensor_id']}&date={sensor['timestamp'].date()}' target='_blank'>Download Daily Graph</a>"
            ),
            "sensor_type": sensor['sensor_type'],
            "color": color
        }
        markers.append(marker)
    return jsonify(markers)

if __name__ == '__main__':
    app.run(debug=True, port=8051)
