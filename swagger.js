const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auto入力Pro API',
      version: '1.0.0',
      description: 'API documentation for Auto入力Pro - Japanese Real Estate Property Management System',
      contact: {
        name: 'Rizal Maulana',
        email: 'rizal@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.autoaipro.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for user authentication',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for third-party access',
        },
      },
      schemas: {
        Property: {
          type: 'object',
          required: ['reins_id', 'user_id'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            user_id: {
              type: 'string',
              description: 'User ID who owns this property',
            },
            reins_id: {
              type: 'string',
              description: 'REINS property ID',
              example: 'REINS-12345',
            },
            prefecture: {
              type: 'string',
              description: 'Prefecture (都道府県)',
              example: '東京都',
            },
            city: {
              type: 'string',
              description: 'City (市区町村)',
              example: '渋谷区',
            },
            town: {
              type: 'string',
              description: 'Town (町名)',
            },
            addressDetail: {
              type: 'string',
              description: 'Address details (番地)',
            },
            buildingName: {
              type: 'string',
              description: 'Building name (建物名)',
              example: 'サンプルマンション',
            },
            roomNumber: {
              type: 'string',
              description: 'Room number (部屋番号)',
              example: '101',
            },
            rent: {
              type: 'string',
              description: 'Monthly rent (賃料)',
              example: '100000',
            },
            securityDeposit: {
              type: 'string',
              description: 'Security deposit (敷金)',
            },
            keyMoney: {
              type: 'string',
              description: 'Key money (礼金)',
            },
            guaranteeDeposit: {
              type: 'string',
              description: 'Guarantee deposit (保証金)',
            },
            managementFee: {
              type: 'string',
              description: 'Management fee (管理費)',
            },
            commonServiceFee: {
              type: 'string',
              description: 'Common service fee (共益費)',
            },
            usableArea: {
              type: 'string',
              description: 'Usable area in m² (専有面積)',
            },
            balconyArea: {
              type: 'string',
              description: 'Balcony area in m² (バルコニー面積)',
            },
            layoutType: {
              type: 'string',
              description: 'Layout type (間取り)',
              example: '1LDK',
            },
            roomCount: {
              type: 'string',
              description: 'Number of rooms (部屋数)',
            },
            constructionDate: {
              type: 'string',
              description: 'Construction date (築年月)',
            },
            buildingStructure: {
              type: 'string',
              description: 'Building structure (建物構造)',
              example: 'RC造',
            },
            railwayLine1: {
              type: 'string',
              description: 'Railway line 1 (路線1)',
            },
            station1: {
              type: 'string',
              description: 'Station 1 (駅1)',
            },
            walkMinutes1: {
              type: 'string',
              description: 'Walk minutes from station 1 (徒歩分)',
            },
            files: {
              type: 'object',
              properties: {
                html_path: { type: 'string' },
                html_filename: { type: 'string' },
                floorplan_path: { type: 'string' },
                floorplan_filename: { type: 'string' },
                image_paths: {
                  type: 'array',
                  items: { type: 'string' },
                },
                image_filenames: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        User: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password (hashed)',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              description: 'Error message',
              example: 'An error occurred',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './index.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
