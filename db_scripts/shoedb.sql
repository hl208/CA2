CREATE DATABASE IF NOT EXISTS `C237_24017721_shoedb` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `C237_24017721_shoedb`;

-- Users Table
CREATE TABLE users (
    `id` INT(11) NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `username` VARCHAR(20) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `role` VARCHAR(255) NOT NULL
);

-- Shoes Table
CREATE TABLE shoes (
    `id` INT(11) NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `brand` VARCHAR(100) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `size` VARCHAR(10) NOT NULL,
    `condition` VARCHAR(50) NOT NULL,
    `description` TEXT,
    `price` DECIMAL(10,2) NOT NULL,
    `location` VARCHAR(255) NOT NULL,

    `image_path` VARCHAR(255),
    FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE
);
