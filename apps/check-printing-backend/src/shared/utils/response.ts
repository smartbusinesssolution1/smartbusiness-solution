// Force every endpoint to return the same shape.
import { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {

    const response: Record<string, unknown> = {
        success: true,
        data: data
    }

    res.status(statusCode).json(response)
}

export function sendCreated<T>(res: Response, data: T) {
    sendSuccess(res, data, 201)
}

export function sendNoContent(res: Response) {
    res.status(204).send();
}