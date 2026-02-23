import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'seu_secret_key_aqui';
        console.log("Using secret:", JWT_SECRET ? "exists" : "none");
        const token = jwt.sign({ id: '1', email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

        const payload = {
            origem: "FAZENDA TESTE - SP",
            destino: "DESTINO TEST",
            motorista_id: "1",
            motorista_nome: "MOTORISTA TEST",
            caminhao_id: "1",
            caminhao_placa: "ABC1234",
            fazenda_id: "1",
            fazenda_nome: "FAZENDA TESTE",
            mercadoria: "MERCADORIA",
            mercadoria_id: "1",
            variedade: undefined,
            data_frete: "2026-02-23",
            quantidade_sacas: 100,
            toneladas: 10,
            valor_por_tonelada: 150,
            custos: 0,
            resultado: 1500,
            ticket: null,
            numero_nota_fiscal: null,
        };

        console.log("Sending payload...");
        const res = await fetch("http://localhost:3000/fretes/27", {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Response:", data);
    } catch (error: any) {
        console.error(error.message);
    }
}

run();
