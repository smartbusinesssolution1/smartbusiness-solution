//Base Error Class 
// All custom error extends this class 


export class AppError extends Error {

    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR", isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);

        // correctly set up the prototype chain
        Object.setPrototypeOf(this, new.target.prototype)
    }

}