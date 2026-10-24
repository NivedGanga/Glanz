CREATE TABLE notification_request (
  notification_id uuid NOT NULL REFERENCES notification(id), request_id uuid NOT NULL REFERENCES request(id),
  PRIMARY KEY(notification_id,request_id)
);
CREATE UNIQUE INDEX notification_sent_request_shop ON notification_request(request_id,notification_id);
