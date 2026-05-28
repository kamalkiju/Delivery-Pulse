// db.config.js — connects DeliveryPulse to MongoDB using Mongoose
// Think of this file as the "plug" between your Node server and the database.

// mongoose = a library that makes MongoDB easier to use from JavaScript
// Why Mongoose instead of the raw "mongodb" driver?
//   • You define schemas (shape of data) — like Figma component props for documents
//   • Built-in validation, defaults, and helpers (less boilerplate)
//   • Most Node + MongoDB tutorials and teams use it for production apps
import mongoose from "mongoose";

// connectDB = one async function the server calls once at startup
const connectDB = async () => {
  try {
    // process.env.MONGODB_URI comes from backend/.env
    // Example: mongodb://localhost:27017/deliverypulse
    // The last part ("deliverypulse") is the database name
    let uri =
      process.env.MONGODB_URI ?? "mongodb://localhost:27017/deliverypulse";

    // Atlas URLs without a DB name default to "test" — append deliverypulse safely
    const hasDbPath = /mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri);
    if (!hasDbPath) {
      const q = uri.indexOf("?");
      if (q !== -1) {
        const base = uri.slice(0, q).replace(/\/$/, "");
        uri = `${base}/deliverypulse${uri.slice(q)}`;
      } else {
        uri = `${uri.replace(/\/$/, "")}/deliverypulse`;
      }
    }

    // mongoose.connect() opens the connection to MongoDB
    await mongoose.connect(uri, {
      // useNewUrlParser: true — tells Mongoose to use the newer URL parser
      // (older parser had bugs with special characters in passwords)
      // Note: in Mongoose 6+, this is always on; we keep it here for clarity when learning
      useNewUrlParser: true,

      // useUnifiedTopology: true — uses the modern connection engine
      // (better handling of servers, retries, and connection pooling)
      // Note: in Mongoose 6+, this is the default; safe to list for documentation
      useUnifiedTopology: true,
    });

    // If we reach this line, the database accepted our connection
    console.log(
      `MongoDB connected to ${mongoose.connection.db.databaseName} database`,
    );
  } catch (error) {
    // Log the real error so you can fix .env or start MongoDB
    console.error("MongoDB connection error:", error.message);

    // process.exit(1) stops the entire Node process with a "failure" code
    // Why exit instead of continuing?
    //   • Without DB, login and data APIs would fail in confusing ways
    //   • Failing fast at startup is clearer than a broken app on port 5000
    process.exit(1);
  }
};

// default export = other files do: import connectDB from "./config/db.config.js"
export default connectDB;
