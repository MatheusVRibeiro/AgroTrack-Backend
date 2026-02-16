import { Request } from 'express';
export interface AuthRequest extends Request {
    userId?: string;
    user?: {
        id: string;
        email: string;
    };
}
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map