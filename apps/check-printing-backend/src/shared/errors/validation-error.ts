import { AppError } from "./app-error.js";

export class ValidationError extends AppError {
    public readonly details: Record<string, string[]>;

    constructor(message: string = "validation failed", details: Record<string, string[]> = {}) {
        super(message, 400, "VALIDATION_ERROR");
        this.details = details;
    }
}


/*
const err = new ValidationError(
  "Validation failed",
  {
    email: ["Email is required"],
    password: ["Password too short"]
  }
);

JavaScript internally does something like:

const err = {};                // create empty object

err.message = "Validation failed";
err.statusCode = 400;
err.code = "VALIDATION_ERROR";
err.details = {
  email: ["Email is required"],
  password: ["Password too short"]
};

return err; 

The constructor returns the object automatically.



In code we do somehting like this 
if (!parsed.success) {
  throw new ValidationError(
    "Validation failed",
    z.flattenError(parsed.error).fieldErrors
  );
}


here there are two things ; 

   new ValidationError() --> this creates the object

   and throw ---> actually throws the error object up the stack

new ValidationError(...)
          │
          ▼
throw ValidationError
          │
          ▼
Global Error Handler
          │
          ▼
 HTTP Response


 The Global Error middleware handles it : 

 the Vlaidation Error reaches there , the entire validationError object
 will be passed to global handler
*/