# Saldo do periodo e lucro das vendas

O painel preserva a interface original e distingue dois calculos:

- Saldo do periodo: vendas pela data de venda, menos compras pela data de
  aquisicao, menos despesas pela data do lancamento. Inclui veiculos ainda em
  estoque. Uma venda posterior nao repete a compra em outro periodo.
- Lucro das vendas: soma do resultado atualizado dos veiculos vendidos no
  periodo, descontando o custo de compra e todas as despesas vinculadas ao
  veiculo, inclusive as registradas em outros periodos. Despesas gerais nao
  sao rateadas neste indicador. O calculo usa os custos atuais, assim como o
  backend, e nao representa um fechamento contabil imutavel de meses anteriores.

Os calculos agregam valores em centavos. Campos camelCase e snake_case e IDs
numericos ou em texto sao aceitos para os dados historicos. Datas invalidas ou
ausentes nao recebem uma data presumida. Compras sem data valida e vendas sem
veiculo cadastrado geram aviso; estas vendas nao entram no lucro calculado.

O sistema ainda nao registra conciliacao de pagamentos, parcelas, recebimentos
efetivos ou financiamento. Portanto o saldo segue as datas cadastradas, nao uma
confirmacao de movimentacao bancaria. A interface explicita essa limitacao.

Exemplo: compra de R$ 50.000 em outubro, preparacao de R$ 1.200 em outubro,
mecanica de R$ 800 em novembro e venda de R$ 65.000 em novembro:

| Periodo | Vendas | Compras | Despesas | Saldo | Lucro das vendas |
|---|---:|---:|---:|---:|---:|
| Outubro | 0 | 50.000 | 1.200 | -51.200 | 0 |
| Novembro | 65.000 | 0 | 800 | 64.200 | 13.000 |
| Ambos | 65.000 | 50.000 | 2.000 | 13.000 | 13.000 |

Nenhuma migracao nem regravacao de registros e necessaria. Os testes de regressao
estao em scripts/financeiro.test.cjs e fazem parte da verificacao do GitHub.
