import { Response } from 'express';
import { AuthRequest } from '../types';
export declare class FreteController {
    private gerarProximoIdFrete;
    listar(req: AuthRequest, res: Response): Promise<void>;
    obterPorId(req: AuthRequest, res: Response): Promise<void>;
    criar(req: AuthRequest, res: Response): Promise<void>;
    atualizar(req: AuthRequest, res: Response): Promise<void>;
    deletar(req: AuthRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=FreteController.d.ts.map