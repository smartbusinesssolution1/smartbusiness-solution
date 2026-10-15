import { createEmailSender } from "@smartbusiness/email";
import { email } from "../../config/index.js";
import { logger } from "./logger.js";

// The one email sender for this service, chosen by EMAIL_TRANSPORT. Business code
// imports this and never knows which delivery it is talking to.
export const emailSender = createEmailSender({
  transport: email.transport,
  from: email.from,
  fileDirectory: email.fileDirectory,
  log: (line) => logger.info(line),
});
