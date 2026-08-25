// Background Runner is intentionally not auto-started. MyFixly only dispatches
// this runner for an active accepted trip; it has no job-time tracking behavior.
addEventListener('trip-location', (resolve, reject, args) => {
  try {
    CapacitorGeolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 })
      .then((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }))
      .catch(reject);
  } catch (error) { reject(error); }
});
