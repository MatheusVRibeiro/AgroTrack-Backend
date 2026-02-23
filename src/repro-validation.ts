import { CriarMotoristaSchemaWithVinculo, AtualizarMotoristaSchemaWithVinculo } from './utils/validators';

const testPayloads = [
    {
        name: 'CREATE Payload with empty strings and extra fields',
        schema: CriarMotoristaSchemaWithVinculo,
        raw: {
            nome: 'TESTE MOTORISTA NOVO',
            telefone: '11999999999',
            status: 'ativo',
            tipo: 'proprio',
            tipo_pagamento: 'pix',

            // Should be normalized to null by controller
            documento: '',
            email: '',
            veiculo_id: '',

            // Extra fields from frontend (should be ignored by Zod now)
            documento_tipo: 'CPF',
            codigo_motorista: 'MOT-NEW',
        }
    },
    {
        name: 'UPDATE Payload with empty strings and extra fields',
        schema: AtualizarMotoristaSchemaWithVinculo,
        raw: {
            nome: 'TESTE MOTORISTA ATUALIZADO',

            // Should be normalized to null by controller
            documento: '',
            email: '',
            veiculo_id: '',

            // Extra fields from frontend (should be ignored by Zod now)
            documento_tipo: 'CPF',
            codigo_motorista: 'MOT-UPDATE',
        }
    }
];

function runTests() {
    console.log('--- STARTING VALIDATION TESTS ---');

    testPayloads.forEach(t => {
        console.log(`\nTesting: ${t.name}`);

        // Simulate Controller Normalization
        const cleanedRequest: any = { ...t.raw };
        ['email', 'banco', 'agencia', 'conta', 'chave_pix', 'tipo_conta', 'endereco', 'veiculo_id', 'documento']
            .forEach((k) => {
                if (k in cleanedRequest && cleanedRequest[k] === '') {
                    cleanedRequest[k] = null;
                }
            });

        try {
            t.schema.parse(cleanedRequest);
            console.log('Result: SUCCESS ✅');
        } catch (error: any) {
            console.log('Result: VALIDATION ERROR ❌');
            if (error.issues) {
                console.log('Issues:', JSON.stringify(error.issues.map((i: any) => ({ path: i.path, message: i.message, code: i.code })), null, 2));
            } else {
                console.log('Error:', error);
            }
        }
    });
}

runTests();
