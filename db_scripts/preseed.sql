-- Insert sample users
INSERT INTO users (username, email, password, address, contact, role)
VALUES 
('alice', 'alice@example.com', 'hashedpassword123', '123 Sneaker Street', '91234567', 'seller'),
('bob', 'bob@example.com', 'hashedpassword456', '456 Runner Road', '98765432', 'user');

-- Insert sample shoes with image paths
INSERT INTO shoes (user_id, brand, model, size, `condition`, description, price, image_path)
VALUES
(1, 'New Balance', '574 Core', '9', 'Like New', 'Classic New Balance sneakers with ENCAP cushioning.', 139.00, '/images/new_balance.png'),
(2, 'Adidas', 'Superstar', '8', 'Used', 'Timeless shell-toe Adidas with some creases.', 89.00, '/images/adidas.png');
