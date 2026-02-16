import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export interface JwtPayload {
    id: string;
    email: string;
}
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const generateToken: (id: string, email: string) => string;
//# sourceMappingURL=auth.d.ts.map