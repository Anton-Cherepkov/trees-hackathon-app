import * as SQLite from 'expo-sqlite';

export interface TreeRecord {
  id?: number;
  imageUri: string;
  boundingBox: BoundingBox;
  dateTaken: string;
  description: string;
  additionalImages: string[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

class TreeDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  async init() {
    if (this.initialized && this.db) {
      console.log('Database already initialized');
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync('trees.db');
      
      await this.db.execAsync(`
        PRAGMA journal_mode = WAL;
        
        CREATE TABLE IF NOT EXISTS trees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          imageUri TEXT NOT NULL,
          boundingBoxX REAL NOT NULL,
          boundingBoxY REAL NOT NULL,
          boundingBoxWidth REAL NOT NULL,
          boundingBoxHeight REAL NOT NULL,
          dateTaken TEXT NOT NULL,
          description TEXT DEFAULT '',
          additionalImages TEXT DEFAULT '[]'
        );
      `);
      
      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      this.initialized = false;
      throw error;
    }
  }

  async insertTree(tree: Omit<TreeRecord, 'id'>): Promise<number> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      const result = await this.db!.runAsync(
        `INSERT INTO trees (imageUri, boundingBoxX, boundingBoxY, boundingBoxWidth, boundingBoxHeight, dateTaken, description, additionalImages)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tree.imageUri,
          tree.boundingBox.x,
          tree.boundingBox.y,
          tree.boundingBox.width,
          tree.boundingBox.height,
          tree.dateTaken,
          tree.description,
          JSON.stringify(tree.additionalImages)
        ]
      );
      
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Insert tree error:', error);
      throw error;
    }
  }

  async getAllTrees(): Promise<TreeRecord[]> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      const rows = await this.db!.getAllAsync('SELECT * FROM trees ORDER BY dateTaken DESC');
      
      return rows.map((row: any) => ({
        id: row.id,
        imageUri: row.imageUri,
        boundingBox: {
          x: row.boundingBoxX,
          y: row.boundingBoxY,
          width: row.boundingBoxWidth,
          height: row.boundingBoxHeight,
        },
        dateTaken: row.dateTaken,
        description: row.description,
        additionalImages: JSON.parse(row.additionalImages || '[]'),
      }));
    } catch (error) {
      console.error('Get all trees error:', error);
      throw error;
    }
  }

  async getTreeById(id: number): Promise<TreeRecord | null> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      const row = await this.db!.getFirstAsync('SELECT * FROM trees WHERE id = ?', [id]);
      
      if (!row) return null;
      
      return {
        id: (row as any).id,
        imageUri: (row as any).imageUri,
        boundingBox: {
          x: (row as any).boundingBoxX,
          y: (row as any).boundingBoxY,
          width: (row as any).boundingBoxWidth,
          height: (row as any).boundingBoxHeight,
        },
        dateTaken: (row as any).dateTaken,
        description: (row as any).description,
        additionalImages: JSON.parse((row as any).additionalImages || '[]'),
      };
    } catch (error) {
      console.error('Get tree by id error:', error);
      throw error;
    }
  }

  async updateTree(id: number, updates: Partial<TreeRecord>): Promise<void> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      const fields = [];
      const values = [];
      
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      
      if (updates.additionalImages !== undefined) {
        fields.push('additionalImages = ?');
        values.push(JSON.stringify(updates.additionalImages));
      }
      
      if (fields.length === 0) return;
      
      values.push(id);
      
      await this.db!.runAsync(
        `UPDATE trees SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      console.error('Update tree error:', error);
      throw error;
    }
  }

  async deleteTree(id: number): Promise<void> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      await this.db!.runAsync('DELETE FROM trees WHERE id = ?', [id]);
    } catch (error) {
      console.error('Delete tree error:', error);
      throw error;
    }
  }

  async clearAllTrees(): Promise<void> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      await this.db!.runAsync('DELETE FROM trees');
      console.log('All trees cleared from database');
    } catch (error) {
      console.error('Clear all trees error:', error);
      throw error;
    }
  }
}

export const treeDatabase = new TreeDatabase();