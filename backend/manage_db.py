#!/usr/bin/env python3
"""
Database Management CLI for Crypto Portfolio App
Usage: python manage_db.py <command>
"""

import sys
import os
from pathlib import Path

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent / "app"))

from database import (
    create_all_tables, drop_all_tables, get_database_info,
    SessionLocal, User, Asset, CurrentPrice
)
from sqlalchemy import text
import argparse
from datetime import datetime

def create_tables():
    """Create all database tables"""
    print("🏗️ Creating database tables...")
    create_all_tables()
    print("✅ Database tables created successfully!")

def drop_tables():
    """Drop all database tables"""
    confirm = input("⚠️ This will DELETE ALL DATA! Type 'DELETE' to confirm: ")
    if confirm == "DELETE":
        drop_all_tables()
        print("🗑️ All tables dropped successfully!")
    else:
        print("❌ Operation cancelled.")

def show_info():
    """Show database information"""
    info = get_database_info()
    print("📊 Database Information:")
    print(f"   Path: {info['path']}")
    print(f"   Exists: {info['exists']}")
    print(f"   Size: {info['size_mb']} MB")
    
    if info['exists']:
        # Show table counts
        db = SessionLocal()
        try:
            tables_info = [
                ("users", User),
                ("assets", Asset),
                ("current_prices", CurrentPrice)
            ]
            
            print("\n📋 Table Information:")
            for table_name, model in tables_info:
                count = db.query(model).count()
                print(f"   {table_name}: {count} records")
                
        except Exception as e:
            print(f"   Error reading tables: {e}")
        finally:
            db.close()

def reset_database():
    """Reset database (drop and recreate all tables)"""
    confirm = input("⚠️ This will RESET ALL DATA! Type 'RESET' to confirm: ")
    if confirm == "RESET":
        print("🔄 Resetting database...")
        drop_all_tables()
        create_all_tables()
        print("✅ Database reset completed!")
    else:
        print("❌ Operation cancelled.")

def backup_database():
    """Create a backup of the database"""
    info = get_database_info()
    if not info['exists']:
        print("❌ Database doesn't exist!")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = Path(info['path']).parent / f"backup_crypto_portfolio_{timestamp}.db"
    
    import shutil
    shutil.copy2(info['path'], backup_path)
    print(f"💾 Database backed up to: {backup_path}")

def restore_database():
    """Restore database from backup"""
    backup_dir = Path(get_database_info()['path']).parent
    backup_files = list(backup_dir.glob("backup_crypto_portfolio_*.db"))
    
    if not backup_files:
        print("❌ No backup files found!")
        return
    
    print("📁 Available backups:")
    for i, backup_file in enumerate(backup_files, 1):
        print(f"   {i}. {backup_file.name}")
    
    try:
        choice = int(input("Enter backup number to restore: ")) - 1
        if 0 <= choice < len(backup_files):
            import shutil
            shutil.copy2(backup_files[choice], get_database_info()['path'])
            print(f"✅ Database restored from: {backup_files[choice].name}")
        else:
            print("❌ Invalid choice!")
    except (ValueError, IndexError):
        print("❌ Invalid input!")

def run_query():
    """Run a custom SQL query"""
    query = input("Enter SQL query: ")
    if not query.strip():
        print("❌ Empty query!")
        return
    
    db = SessionLocal()
    try:
        if query.lower().strip().startswith('select'):
            # Read query
            result = db.execute(text(query))
            rows = result.fetchall()
            
            if rows:
                # Print column headers
                print(f"📊 Results ({len(rows)} rows):")
                if hasattr(result, 'keys') and result.keys():
                    headers = list(result.keys())
                    print("   " + " | ".join(headers))
                    print("   " + "-" * (len(" | ".join(headers))))
                
                # Print rows
                for row in rows:
                    print("   " + " | ".join(str(cell) for cell in row))
            else:
                print("📋 No results found.")
        else:
            # Write query
            db.execute(text(query))
            db.commit()
            print("✅ Query executed successfully!")
            
    except Exception as e:
        print(f"❌ Query error: {e}")
        db.rollback()
    finally:
        db.close()

def optimize_database():
    """Optimize database performance"""
    print("⚡ Optimizing database...")
    
    db = SessionLocal()
    try:
        # Run VACUUM to reclaim space
        db.execute(text("VACUUM"))
        
        # Analyze tables for better query planning
        db.execute(text("ANALYZE"))
        
        # Reindex all indexes
        db.execute(text("REINDEX"))
        
        db.commit()
        print("✅ Database optimized successfully!")
        
    except Exception as e:
        print(f"❌ Optimization error: {e}")