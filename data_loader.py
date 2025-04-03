import pandas as pd

def load_sensor_data(csv_file: str):
    df = pd.read_csv(csv_file)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df