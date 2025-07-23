DELETE FROM shoes
WHERE id NOT IN (
    SELECT * FROM (
        SELECT MIN(id)
        FROM shoes
        GROUP BY user_id, brand, model, size, `condition`, price, image_path
    ) AS keep_ids
);

DELETE FROM users
WHERE id NOT IN (
    SELECT * FROM (
        SELECT MIN(id)
        FROM users
        GROUP BY email
    ) AS keep_ids
);
