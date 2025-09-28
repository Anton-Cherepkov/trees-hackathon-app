import * as SQLite from 'expo-sqlite';

export interface TreeRecord {
  id?: number;
  imageUri: string;
  boundingBox: BoundingBox;
  dateTaken: string;
  description: string;
  additionalImages: string[];
  cropPath?: string;
  taxonName?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DefectRecord {
  defect_id?: number;
  tree_id: number;
  xtl: number;
  ytl: number;
  xbr: number;
  ybr: number;
  image_path: string;
  crop_path: string;
  defect_type: string;
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
      this.db = await SQLite.openDatabaseAsync('trees.db', {useNewConnection: true});
      
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
          additionalImages TEXT DEFAULT '[]',
          cropPath TEXT DEFAULT '',
          taxonName TEXT DEFAULT NULL
        );
        
        CREATE TABLE IF NOT EXISTS defects (
          defect_id INTEGER PRIMARY KEY AUTOINCREMENT,
          tree_id INTEGER NOT NULL,
          xtl REAL NOT NULL,
          ytl REAL NOT NULL,
          xbr REAL NOT NULL,
          ybr REAL NOT NULL,
          image_path TEXT NOT NULL,
          crop_path TEXT NOT NULL,
          defect_type TEXT NOT NULL,
          FOREIGN KEY (tree_id) REFERENCES trees (id) ON DELETE CASCADE
        );
      `);
      
      // Add cropPath column if it doesn't exist (for existing databases)
      try {
        await this.db.execAsync(`
          ALTER TABLE trees ADD COLUMN cropPath TEXT DEFAULT '';
        `);
      } catch (error) {
        // Column already exists, ignore the error
        console.log('cropPath column already exists or migration not needed');
      }
      
      // Add taxonName column if it doesn't exist (for existing databases)
      try {
        await this.db.execAsync(`
          ALTER TABLE trees ADD COLUMN taxonName TEXT DEFAULT NULL;
        `);
      } catch (error) {
        // Column already exists, ignore the error
        console.log('taxonName column already exists or migration not needed');
      }
      
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
        `INSERT INTO trees (imageUri, boundingBoxX, boundingBoxY, boundingBoxWidth, boundingBoxHeight, dateTaken, description, additionalImages, cropPath, taxonName)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tree.imageUri,
          tree.boundingBox.x,
          tree.boundingBox.y,
          tree.boundingBox.width,
          tree.boundingBox.height,
          tree.dateTaken,
          tree.description,
          JSON.stringify(tree.additionalImages),
          tree.cropPath || '',
          tree.taxonName || null
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
        cropPath: row.cropPath || '',
        taxonName: row.taxonName || null,
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
        cropPath: (row as any).cropPath || '',
        taxonName: (row as any).taxonName || null,
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
      
      if (updates.taxonName !== undefined) {
        fields.push('taxonName = ?');
        values.push(updates.taxonName);
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

  // Defect-related methods
  async insertDefect(defect: Omit<DefectRecord, 'defect_id'>): Promise<number> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      const result = await this.db!.runAsync(
        `INSERT INTO defects (tree_id, xtl, ytl, xbr, ybr, image_path, crop_path, defect_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          defect.tree_id,
          defect.xtl,
          defect.ytl,
          defect.xbr,
          defect.ybr,
          defect.image_path,
          defect.crop_path,
          defect.defect_type
        ]
      );
      
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Insert defect error:', error);
      throw error;
    }
  }

  async getDefectsByTreeId(treeId: number): Promise<DefectRecord[]> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      const rows = await this.db!.getAllAsync(
        'SELECT * FROM defects WHERE tree_id = ? ORDER BY defect_id ASC',
        [treeId]
      );
      
      return rows.map((row: any) => ({
        defect_id: row.defect_id,
        tree_id: row.tree_id,
        xtl: row.xtl,
        ytl: row.ytl,
        xbr: row.xbr,
        ybr: row.ybr,
        image_path: row.image_path,
        crop_path: row.crop_path,
        defect_type: row.defect_type,
      }));
    } catch (error) {
      console.error('Get defects by tree id error:', error);
      throw error;
    }
  }

  async deleteDefect(defectId: number): Promise<void> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      await this.db!.runAsync('DELETE FROM defects WHERE defect_id = ?', [defectId]);
    } catch (error) {
      console.error('Delete defect error:', error);
      throw error;
    }
  }

  async deleteDefectsByTreeId(treeId: number): Promise<void> {
    if (!this.db || !this.initialized) {
      await this.init();
    }
    
    try {
      await this.db!.runAsync('DELETE FROM defects WHERE tree_id = ?', [treeId]);
    } catch (error) {
      console.error('Delete defects by tree id error:', error);
      throw error;
    }
  }
}

export const treeDatabase = new TreeDatabase();