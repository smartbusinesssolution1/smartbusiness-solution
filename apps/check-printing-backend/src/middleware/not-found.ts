// 404 not found handler
// catches request that didnt match any route.

import { Request, Response, NextFunction } from "express";


export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
    return res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: ` Route ${req.method} ${req.originalUrl} not found`
        }
    })
}