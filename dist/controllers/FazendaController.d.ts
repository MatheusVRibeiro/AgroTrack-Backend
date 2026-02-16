import { Request, Response } from 'express';
export declare class FazendaController {
    listar(_req: Request, res: Response): Promise<void>;
    obterPorId(req: Request, res: Response): Promise<void>;
    criar(req: Request, res: Response): Promise<void>;
    atualizar(req: Request, res: Response): Promise<void>;
    deletar(req: Request, res: Response): Promise<void>;
    incrementarVolume(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=FazendaController.d.ts.map