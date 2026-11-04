-- Idempotent data migration. Preserve the document meaning; never infer no pending issue.
DO $migration$
DECLARE
    legacy record;
    option_id text;
    option_code text;
BEGIN
    PERFORM pg_advisory_xact_lock(1296253261);
    FOR legacy IN SELECT * FROM (VALUES
        ('sim', 'Documento na loja'),
        ('nao', 'Não possui documento'),
        ('pendente', 'Entrega de documento pendente')
    ) AS values_to_migrate(value, label)
    LOOP
        IF EXISTS (SELECT 1 FROM crm_records WHERE module = 'estoque'
            AND coalesce(nullif(payload->>'documentStatus', ''), payload->>'document_status') = legacy.value) THEN
            SELECT id, payload->>'code' INTO option_id, option_code FROM crm_records
                WHERE module = 'pendencias' AND legacy_id = 'pending-legacy:' || legacy.value;
            IF option_id IS NULL THEN
                option_id := gen_random_uuid()::text;
                option_code := 'pending:' || option_id;
                INSERT INTO crm_records(id, module, legacy_id, payload)
                    VALUES(option_id, 'pendencias', 'pending-legacy:' || legacy.value,
                        jsonb_build_object('code', option_code, 'name', legacy.label, 'legacyValue', legacy.value));
            END IF;
            UPDATE crm_records SET payload = payload || jsonb_build_object(
                'documentStatus', option_code, 'document_status', option_code,
                'documentStatusBeforeCatalogMigration', legacy.value), version = version + 1
                WHERE module = 'estoque'
                AND coalesce(nullif(payload->>'documentStatus', ''), payload->>'document_status') = legacy.value;
        END IF;
    END LOOP;
END
$migration$;
