// Plugin to display "No data to display" message on empty charts

export const noDataPlugin = {
  id: 'noDataMessage',
  afterDraw(chart) {
    const hasRealData = chart.data.datasets.some(ds =>
      ds.data.some(point => point.y !== null)
    );
    if (!hasRealData) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#888';
      ctx.fillText('No data to display', width / 2, height / 2);
      ctx.restore();
    }
  }
};
