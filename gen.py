import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random



def generate_sensor_data(sensor_ids, values_per_sensor, start_time, delta_minutes):
    records = []
    sensor_types = ["temperature", "humidity", "light", "sound", "motion", "pressure"]
    sensor_units = {
        "temperature": "°C",
        "humidity": "%",
        "light": "lux",
        "sound": "dB",
        "motion": "count",
        "pressure": "hPa"
    }

    for sensor_id in sensor_ids:
        sensor_type = random.choice(sensor_types)
        unit = sensor_units[sensor_type]
        latitude = round(random.uniform(44.43, 44.44), 6)
        longitude = round(random.uniform(26.05, 26.06), 6)

        for i in range(values_per_sensor):
            timestamp = start_time + timedelta(minutes=i * delta_minutes)
            value = round(random.uniform(0, 100), 2)
            is_indoor = random.choice([True, False])
            floor = random.choice([0, 1, 2, 3])
            records.append({
                "device_id": sensor_id,
                "sensor_type": sensor_type,
                "value": value,
                "unit": unit,
                "timestamp": timestamp,
                "location": "asd",
                "latitude": latitude,
                "longitude": longitude,
                "is_indoor": is_indoor,
                "floor": floor
            })

    return pd.DataFrame(records)


start_time = datetime(2025, 6, 6, 0, 0, 0)

# # Small dataset: 1 sensor, 10 values
# small_df = generate_sensor_data(["sensor-1"], 10, start_time, 60)
#
# # Medium dataset: 10 sensors, 1000 values each
# medium_sensor_ids = [f"sensor-{i}" for i in range(1, 11)]
# medium_df = generate_sensor_data(medium_sensor_ids, 100, start_time, 1)

# Large dataset: 1000 sensors, 10000 values each
large_sensor_ids = [f"sensor-{i}" for i in range(1, 101)]
large_df = generate_sensor_data(large_sensor_ids, 2000, start_time, 1)

# Save to CSV
# small_path = "./sensor_data_small.csv"
# medium_path = "./sensor_data_medium.csv"
large_path = "./sensor_data_large.csv"

# small_df.to_csv(small_path, index=False)
# medium_df.to_csv(medium_path, index=False)
large_df.to_csv(large_path, index=False)

