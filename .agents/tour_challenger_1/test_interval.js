setInterval(() => {
  console.log("Tick");
  throw new Error("Boom");
}, 100);
setTimeout(() => process.exit(0), 500);
