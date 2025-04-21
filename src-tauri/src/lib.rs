// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: i64,
    pub name: String,
    pub current_selling_price: f64,
    pub date_created: String,
    pub date_modified: String,
    pub owned: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PriceHistoryEntry {
    pub id: i64,
    pub item_id: i64,
    pub price: f64,
    pub date: String,
    pub author: String,
    pub sold: bool,
}

struct DbConn(Mutex<Connection>);

fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            current_selling_price REAL NOT NULL,
            date_created TEXT NOT NULL,
            date_modified TEXT NOT NULL,
            owned BOOLEAN NOT NULL DEFAULT 0
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            price REAL NOT NULL,
            date TEXT NOT NULL,
            author TEXT NOT NULL,
            sold BOOLEAN NOT NULL,
            FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_items(state: State<DbConn>) -> Result<Vec<Item>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, current_selling_price, date_created, date_modified, owned FROM items")
        .map_err(|e| e.to_string())?;
    let items_iter = stmt.query_map([], |row| {
        Ok(Item {
            id: row.get(0)?,
            name: row.get(1)?,
            current_selling_price: row.get(2)?,
            date_created: row.get(3)?,
            date_modified: row.get(4)?,
            owned: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut items = Vec::new();
    for item in items_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
fn add_item(
    state: State<DbConn>,
    name: String,
    current_selling_price: f64,
    owned: Option<bool>,
) -> Result<(), String> {
    println!("add_item called: name={:?}, current_selling_price={:?}, owned={:?}", name, current_selling_price, owned);
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    let owned_val = match owned {
        Some(v) => v,
        None => false,
    };
    // Defensive: Log type info
    if let Some(ref v) = owned {
        if !matches!(v, true | false) {
            println!("ERROR: 'owned' is not a boolean: {:?}", v);
            return Err("Invalid value for 'owned'. Must be a boolean.".to_string());
        }
    }
    match conn.execute(
        "INSERT INTO items (name, current_selling_price, date_created, date_modified, owned) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, current_selling_price, now, now, owned_val],
    ) {
        Ok(_) => Ok(()),
        Err(e) => {
            println!("add_item DB error: {}", e);
            Err(format!("Failed to add item: {}", e))
        }
    }
}

#[tauri::command]
fn update_item(
    state: State<DbConn>,
    id: i64,
    name: String,
    current_selling_price: f64,
    owned: Option<bool>,
) -> Result<(), String> {
    println!("update_item called: id={:?}, name={:?}, current_selling_price={:?}, owned={:?}", id, name, current_selling_price, owned);
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    let owned_val = match owned {
        Some(v) => v,
        None => false,
    };
    // Defensive: Log type info
    if let Some(ref v) = owned {
        if !matches!(v, true | false) {
            println!("ERROR: 'owned' is not a boolean: {:?}", v);
            return Err("Invalid value for 'owned'. Must be a boolean.".to_string());
        }
    }
    match conn.execute(
        "UPDATE items SET name = ?1, current_selling_price = ?2, date_modified = ?3, owned = ?4 WHERE id = ?5",
        params![name, current_selling_price, now, owned_val, id],
    ) {
        Ok(_) => Ok(()),
        Err(e) => {
            println!("update_item DB error: {}", e);
            Err(format!("Failed to update item: {}", e))
        }
    }
}

#[tauri::command]
fn delete_item(state: State<DbConn>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn search_items(state: State<DbConn>, query: String) -> Result<Vec<Item>, String> {
    let conn = state.0.lock().unwrap();
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, name, current_selling_price, date_created, date_modified, owned FROM items WHERE name LIKE ?1"
    ).map_err(|e| e.to_string())?;
    let items_iter = stmt.query_map([pattern], |row| {
        Ok(Item {
            id: row.get(0)?,
            name: row.get(1)?,
            current_selling_price: row.get(2)?,
            date_created: row.get(3)?,
            date_modified: row.get(4)?,
            owned: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut items = Vec::new();
    for item in items_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
fn get_price_history(state: State<DbConn>, item_id: i64) -> Result<Vec<PriceHistoryEntry>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, item_id, price, date, author, sold FROM price_history WHERE item_id = ?1 ORDER BY date DESC"
    ).map_err(|e| e.to_string())?;
    let iter = stmt.query_map([item_id], |row| {
        Ok(PriceHistoryEntry {
            id: row.get(0)?,
            item_id: row.get(1)?,
            price: row.get(2)?,
            date: row.get(3)?,
            author: row.get(4)?,
            sold: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    for entry in iter {
        entries.push(entry.map_err(|e| e.to_string())?);
    }
    Ok(entries)
}

#[tauri::command]
fn add_price_history(
    state: State<DbConn>,
    item_id: i64,
    price: f64,
    date: String,
    author: String,
    sold: bool,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    println!("add_price_history: item_id={}, price={}, date={}, author={}, sold={}", item_id, price, date, author, sold);
    match conn.execute(
        "INSERT INTO price_history (item_id, price, date, author, sold) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![item_id, price, date, author, sold],
    ) {
        Ok(_) => Ok(()),
        Err(e) => {
            println!("add_price_history error: {}", e);
            Err(e.to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = Connection::open("inventory.db").expect("Failed to open database");
    // Enable foreign key support
    conn.execute("PRAGMA foreign_keys = ON", []).expect("Failed to enable foreign keys");
    let pragma_check: i64 = conn.query_row("PRAGMA foreign_keys;", [], |row| row.get(0)).unwrap_or(0);
    println!("PRAGMA foreign_keys = {}", pragma_check);
    init_db(&conn).expect("Failed to initialize database");
    tauri::Builder::default()
        .manage(DbConn(Mutex::new(conn)))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_items, add_item, update_item, delete_item, search_items, get_price_history, add_price_history])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
