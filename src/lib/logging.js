function logBusinessEvent(event, payload) {
  console.info(
    JSON.stringify({
      level: "info",
      type: "business_event",
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}

module.exports = {
  logBusinessEvent,
};

