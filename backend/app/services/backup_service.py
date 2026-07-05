"""
Database Backup and Restore Service
Handles automated backups, restoration, and database management
"""

import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import os
import json

from database.connection import DB_DIR, BACKUP_DIR, IS_SQLITE, IS_POSTGRES, DATABASE_URL


class BackupService:
    """Service for managing database backups and restoration"""
    
    def __init__(self):
        self.backup_dir = BACKUP_DIR
        self.db_dir = DB_DIR
        self.is_sqlite = IS_SQLITE
        self.is_postgres = IS_POSTGRES
        
    def create_backup(self, backup_name: Optional[str] = None) -> Dict[str, any]:
        """
        Create a backup of the current database
        
        Args:
            backup_name: Optional custom name for backup
            
        Returns:
            Dictionary with backup information
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if self.is_sqlite:
            return self._backup_sqlite(timestamp, backup_name)
        elif self.is_postgres:
            return self._backup_postgres(timestamp, backup_name)
        else:
            raise ValueError("Unsupported database type")
    
    def _backup_sqlite(self, timestamp: str, backup_name: Optional[str] = None) -> Dict:
        """Create SQLite backup"""
        db_file = self.db_dir / "crypto_portfolio.db"
        
        if not db_file.exists():
            raise FileNotFoundError("Database file not found")
        
        # Create backup filename
        if backup_name:
            backup_file = self.backup_dir / f"{backup_name}_{timestamp}.db"
        else:
            backup_file = self.backup_dir / f"backup_{timestamp}.db"
        
        # Copy database file
        shutil.copy2(db_file, backup_file)
        
        # Get file sizes
        original_size = db_file.stat().st_size
        backup_size = backup_file.stat().st_size
        
        # Save metadata
        metadata = {
            "timestamp": timestamp,
            "backup_file": str(backup_file.name),
            "original_size_bytes": original_size,
            "backup_size_bytes": backup_size,
            "database_type": "sqlite",
            "created_at": datetime.now().isoformat()
        }
        
        metadata_file = self.backup_dir / f"{backup_file.stem}_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "success": True,
            "backup_file": str(backup_file),
            "size_mb": round(backup_size / (1024 * 1024), 2),
            "timestamp": timestamp,
            "metadata": metadata
        }
    
    def _backup_postgres(self, timestamp: str, backup_name: Optional[str] = None) -> Dict:
        """Create PostgreSQL backup using pg_dump"""
        if backup_name:
            backup_file = self.backup_dir / f"{backup_name}_{timestamp}.sql"
        else:
            backup_file = self.backup_dir / f"backup_{timestamp}.sql"
        
        # Parse DATABASE_URL to get connection details
        # Format: postgresql://user:password@host:port/database
        url_parts = DATABASE_URL.replace("postgresql://", "").split("@")
        user_pass = url_parts[0].split(":")
        host_db = url_parts[1].split("/")
        host_port = host_db[0].split(":")
        
        username = user_pass[0]
        password = user_pass[1] if len(user_pass) > 1 else ""
        host = host_port[0]
        port = host_port[1] if len(host_port) > 1 else "5432"
        database = host_db[1]
        
        # Set password environment variable
        env = os.environ.copy()
        env['PGPASSWORD'] = password
        
        # Run pg_dump
        cmd = [
            "pg_dump",
            "-h", host,
            "-p", port,
            "-U", username,
            "-d", database,
            "-F", "c",  # Custom format for better compression
            "-f", str(backup_file)
        ]
        
        try:
            subprocess.run(cmd, env=env, check=True, capture_output=True, text=True)
            
            backup_size = backup_file.stat().st_size
            
            metadata = {
                "timestamp": timestamp,
                "backup_file": str(backup_file.name),
                "backup_size_bytes": backup_size,
                "database_type": "postgresql",
                "created_at": datetime.now().isoformat(),
                "host": host,
                "database": database
            }
            
            metadata_file = self.backup_dir / f"{backup_file.stem}_metadata.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            return {
                "success": True,
                "backup_file": str(backup_file),
                "size_mb": round(backup_size / (1024 * 1024), 2),
                "timestamp": timestamp,
                "metadata": metadata
            }
        except subprocess.CalledProcessError as e:
            raise Exception(f"PostgreSQL backup failed: {e.stderr}")
    
    def restore_backup(self, backup_file: str) -> Dict[str, any]:
        """
        Restore database from a backup file
        
        Args:
            backup_file: Name of the backup file to restore
            
        Returns:
            Dictionary with restoration information
        """
        backup_path = self.backup_dir / backup_file
        
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_file}")
        
        if self.is_sqlite:
            return self._restore_sqlite(backup_path)
        elif self.is_postgres:
            return self._restore_postgres(backup_path)
        else:
            raise ValueError("Unsupported database type")
    
    def _restore_sqlite(self, backup_path: Path) -> Dict:
        """Restore SQLite backup"""
        db_file = self.db_dir / "crypto_portfolio.db"
        
        # Create a backup of current database before restoring
        if db_file.exists():
            current_backup = self.db_dir / f"pre_restore_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            shutil.copy2(db_file, current_backup)
        
        # Restore from backup
        shutil.copy2(backup_path, db_file)
        
        return {
            "success": True,
            "restored_from": str(backup_path.name),
            "restored_to": str(db_file),
            "size_mb": round(db_file.stat().st_size / (1024 * 1024), 2)
        }
    
    def _restore_postgres(self, backup_path: Path) -> Dict:
        """Restore PostgreSQL backup using pg_restore"""
        url_parts = DATABASE_URL.replace("postgresql://", "").split("@")
        user_pass = url_parts[0].split(":")
        host_db = url_parts[1].split("/")
        host_port = host_db[0].split(":")
        
        username = user_pass[0]
        password = user_pass[1] if len(user_pass) > 1 else ""
        host = host_port[0]
        port = host_port[1] if len(host_port) > 1 else "5432"
        database = host_db[1]
        
        env = os.environ.copy()
        env['PGPASSWORD'] = password
        
        # Drop and recreate database (clean restore)
        # Then restore using pg_restore
        cmd = [
            "pg_restore",
            "-h", host,
            "-p", port,
            "-U", username,
            "-d", database,
            "-c",  # Clean before restore
            "-F", "c",  # Custom format
            str(backup_path)
        ]
        
        try:
            subprocess.run(cmd, env=env, check=True, capture_output=True, text=True)
            
            return {
                "success": True,
                "restored_from": str(backup_path.name),
                "database": database,
                "host": host
            }
        except subprocess.CalledProcessError as e:
            raise Exception(f"PostgreSQL restore failed: {e.stderr}")
    
    def list_backups(self) -> List[Dict]:
        """List all available backups with metadata"""
        backups = []
        
        # Get all backup files
        if self.is_sqlite:
            backup_files = sorted(self.backup_dir.glob("*.db"), key=lambda x: x.stat().st_mtime, reverse=True)
        else:
            backup_files = sorted(self.backup_dir.glob("*.sql"), key=lambda x: x.stat().st_mtime, reverse=True)
        
        for backup_file in backup_files:
            metadata_file = self.backup_dir / f"{backup_file.stem}_metadata.json"
            
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
            else:
                # Create basic metadata if not exists
                metadata = {
                    "backup_file": backup_file.name,
                    "backup_size_bytes": backup_file.stat().st_size,
                    "created_at": datetime.fromtimestamp(backup_file.stat().st_mtime).isoformat()
                }
            
            backups.append({
                "filename": backup_file.name,
                "size_mb": round(backup_file.stat().st_size / (1024 * 1024), 2),
                "created_at": metadata.get("created_at"),
                "metadata": metadata
            })
        
        return backups
    
    def delete_backup(self, backup_file: str) -> Dict[str, any]:
        """Delete a specific backup file"""
        backup_path = self.backup_dir / backup_file
        metadata_file = self.backup_dir / f"{Path(backup_file).stem}_metadata.json"
        
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_file}")
        
        # Delete backup file
        backup_path.unlink()
        
        # Delete metadata if exists
        if metadata_file.exists():
            metadata_file.unlink()
        
        return {
            "success": True,
            "deleted": backup_file
        }
    
    def auto_cleanup(self, keep_last_n: int = 30) -> Dict[str, any]:
        """
        Automatically clean up old backups, keeping only the most recent N backups
        
        Args:
            keep_last_n: Number of recent backups to keep (default: 30)
            
        Returns:
            Dictionary with cleanup information
        """
        backups = self.list_backups()
        
        if len(backups) <= keep_last_n:
            return {
                "success": True,
                "deleted_count": 0,
                "remaining_count": len(backups),
                "message": f"No cleanup needed. Current backups: {len(backups)}"
            }
        
        # Delete old backups
        backups_to_delete = backups[keep_last_n:]
        deleted_count = 0
        
        for backup in backups_to_delete:
            try:
                self.delete_backup(backup["filename"])
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting {backup['filename']}: {e}")
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "remaining_count": len(backups) - deleted_count,
            "message": f"Cleaned up {deleted_count} old backups"
        }
    
    def get_database_info(self) -> Dict[str, any]:
        """Get information about the current database"""
        if self.is_sqlite:
            db_file = self.db_dir / "crypto_portfolio.db"
            if db_file.exists():
                return {
                    "database_type": "sqlite",
                    "database_path": str(db_file),
                    "size_mb": round(db_file.stat().st_size / (1024 * 1024), 2),
                    "exists": True
                }
            else:
                return {
                    "database_type": "sqlite",
                    "database_path": str(db_file),
                    "size_mb": 0,
                    "exists": False
                }
        else:
            return {
                "database_type": "postgresql",
                "database_url": DATABASE_URL.split("@")[1] if "@" in DATABASE_URL else "unknown",
                "exists": True
            }


# Singleton instance
backup_service = BackupService()
