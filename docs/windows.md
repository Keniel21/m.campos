# Pacote Windows

Preparacao em desenvolvimento. Ainda nao homologado para a loja.

O pacote inclui Java 21, backend e a interface original. Exige Windows x64 e internet para acessar o Neon. Nao oferece operacao offline.

## Gerar

Execute em PowerShell, usando o JAR produzido pela CI e um JDK 21 Windows x64:

```powershell
./scripts/package-windows.ps1 -Jar ./backend/target/crm-2.0.0-SNAPSHOT.jar -JavaHome 'C:/caminho/jdk-21' -Version '2.0.0-preview.1' -OutputDirectory 'C:/caminho/pacotes'
```

O script inclui todos os modulos do runtime para compatibilidade e preserva os avisos legais do JDK. Copia somente uma lista explicita de arquivos da aplicacao. Nao inclui senhas, documentos, banco nem logs. Gera ZIP e SHA-256. O JDK distribuido deve permitir redistribuicao; a CI utiliza Temurin OpenJDK.

## Configurar e iniciar

Para a instalacao inicial, o mantenedor pode usar `Install-Mcampos.ps1`, informando `-PackageDirectory`, `-PrivateConfigFile` (credencial limitada de producao) e `-DocumentsDirectory`. O instalador valida os hashes dos documentos, recusa sobrescrever dados existentes, restringe as permissoes da pasta e cria o atalho. Use `-DataDirectory` e `-NoShortcut` em ensaios isolados. O banco definitivo foi preparado separadamente; o instalador nao restaura nem migra o PostgreSQL.

1. Extraia o ZIP em uma pasta nova.
2. Crie `%LOCALAPPDATA%\Mcampos` e copie `config.env.example` para `config.env` nessa pasta.
3. O responsavel tecnico configura a conexao e os segredos, usando a credencial limitada do aplicativo. Nao enviar esse arquivo por chat nem inclui-lo no Git.
4. Copie os documentos ja migrados para `%LOCALAPPDATA%\Mcampos\documents`, preservando os nomes por hash. Sem essa copia, os registros existem, mas os anexos nao abrem.
5. Execute `Iniciar.cmd`. O navegador abre depois de uma leitura bem-sucedida do banco. Logs ficam na pasta `logs` dos dados locais.

As migracoes e importacoes ficam desativadas no iniciador. Antes de liberar uma versao, o mantenedor prepara o banco com backup e migracoes separadamente. A configuracao de desenvolvimento nao deve ser usada na loja.

## Atualizar

Faca backup do banco e da pasta de documentos. Encerre o processo Java do aplicativo antes de atualizar. Extraia a nova versao em outra pasta e use seu `Iniciar.cmd`. A configuracao, documentos e logs permanecem em LocalAppData. Conserve a pasta anterior para retorno; restaurar apenas o programa nao desfaz migracoes de banco.

Para testar sem usar os dados da loja:

```powershell
./Start-Mcampos.ps1 -DataDirectory 'C:/caminho/dados-teste' -NoBrowser
```

Use uma configuracao propria nessa pasta, banco de restauracao e porta livre. O iniciador recusa portas ocupadas. Ainda falta homologar o ZIP real, a atualizacao e o atalho no computador de destino antes de promover para producao.
