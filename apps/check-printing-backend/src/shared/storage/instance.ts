import { storage as storageConfig } from "../../config/index.js";
import { createStorage } from "./index.js";

// The app's one encrypted file storage (local folder in development, S3 in
// production), shared by check PDFs, signatures and attachments.
export const fileStorage = createStorage(storageConfig);
