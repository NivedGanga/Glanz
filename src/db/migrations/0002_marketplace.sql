ALTER TABLE shop ADD COLUMN rating_score numeric(3,2);
ALTER TABLE shop ADD COLUMN response_rate numeric(4,3);
CREATE INDEX block_unit_range ON availability_block USING gist(unit_id,time_range);
CREATE INDEX design_shop_status ON design(shop_id,status,category_id);
