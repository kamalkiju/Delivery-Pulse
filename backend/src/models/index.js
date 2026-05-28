// index.js — barrel file: import all models from this one place in services
//
// Example in a service file:
//   import { User, Client, Story } from "../models/index.js";
//
// Why one file?
//   • Cleaner imports than nine separate paths
//   • Ensures all schemas are registered with Mongoose when first imported

import Organisation from "./Organisation.model.js";
import User from "./User.model.js";
import Client from "./Client.model.js";
import Story from "./Story.model.js";
import SlackMessage from "./SlackMessage.model.js";
import Meeting from "./Meeting.model.js";
import Document from "./Document.model.js";
import HealthScore from "./HealthScore.model.js";
import Commitment from "./Commitment.model.js";
import PendingSignup from "./PendingSignup.model.js";
import PasswordReset from "./PasswordReset.model.js";

export {
  Organisation,
  User,
  Client,
  Story,
  SlackMessage,
  Meeting,
  Document,
  HealthScore,
  Commitment,
  PendingSignup,
  PasswordReset,
};

// Default export object (same as named exports) for convenience
export default {
  Organisation,
  User,
  Client,
  Story,
  SlackMessage,
  Meeting,
  Document,
  HealthScore,
  Commitment,
  PendingSignup,
  PasswordReset,
};
