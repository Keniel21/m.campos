-- Numeric aliases preserve the original frontend's event handlers.
CREATE SEQUENCE crm_public_id_seq START WITH 10000000000000;
ALTER TABLE crm_records ADD COLUMN public_id BIGINT NOT NULL DEFAULT nextval('crm_public_id_seq');
ALTER TABLE crm_records ADD CONSTRAINT uq_crm_public_id UNIQUE(public_id);
