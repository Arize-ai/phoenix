/* connection.h - definitions for the connection type
 *
 * Copyright (C) 2004-2010 Gerhard Häring <gh@ghaering.de>
 *
 * Modified by the Arize Phoenix team, 2026.
 *
 * This file is part of pysqlite.
 *
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 */

#ifndef PYSQLITE_CONNECTION_H
#define PYSQLITE_CONNECTION_H
#define PY_SSIZE_T_CLEAN
#include "Python.h"
#include "pythread.h"
#include "structmember.h"

#include "cache.h"
#include "module.h"

#include "sqlite3.h"

typedef struct
{
    PyObject_HEAD
    sqlite3* db;

    /* the type detection mode. Only 0, PARSE_DECLTYPES, PARSE_COLNAMES or a
     * bitwise combination thereof makes sense */
    int detect_types;

    /* the timeout value in seconds for database locks */
    double timeout;

    /* for internal use in the timeout handler: when did the timeout handler
     * first get called with count=0? */
    double timeout_started;

    /* None for autocommit, otherwise a PyUnicode with the isolation level */
    PyObject* isolation_level;

    /* NULL for autocommit, otherwise a string with the BEGIN statement */
    const char* begin_statement;

    /* 1 if a check should be performed for each API call if the connection is
     * used from the same thread it was created in */
    int check_same_thread;

    int initialized;

    /* thread identification of the thread the connection was created in */
    unsigned long thread_ident;

    pysqlite_Cache* statement_cache;

    /* Lists of weak references to statements, blobs and cursors used within this connection */
    PyObject* statements;
    PyObject* cursors;
    PyObject* blobs;

    /* Counters for how many statements/cursors were created in the connection. May be
     * reset to 0 at certain intervals */
    int created_statements;
    int created_cursors;

    PyObject* row_factory;

    /* Determines how bytestrings from SQLite are converted to Python objects:
     * - PyUnicode_Type:        Python Unicode objects are constructed from UTF-8 bytestrings
     * - PyBytes_Type:          The bytestrings are returned as-is.
     * - Any custom callable:   Any object returned from the callable called with the bytestring
     *                          as single parameter.
     */
    PyObject* text_factory;

    /* remember references to functions/classes used in trace/progress/auth cb */
    PyObject* function_pinboard_trace_callback;
    PyObject* function_pinboard_progress_handler;
    PyObject* function_pinboard_authorizer_cb;
    PyObject* function_pinboard_busy_handler_cb;

    /* a dictionary of registered collation name => collation callable mappings */
    PyObject* collations;

    /* Non-zero while a sqlite3_* call that may invoke a Python
       callback is on the C stack. close(), rollback(), re-init, and
       cursor close or re-init refuse to tear down handles in that
       window: re-entering finalize/reset/close crashes when the native
       call resumes. backup() refuses to start there as well, on either
       end: its retry loop can only spin against the connection's own
       in-progress statement. Registering functions or collations is
       left to SQLite, which refuses to replace one while a statement is
       active and can safely add a new one. */
    int in_sqlite;

    /* Non-zero while sqlite3_reset/finalize is on the C stack. commit()
       is refused here because SQLite will accept COMMIT while statements
       are mid-reset, turning rollback into a commit. Backup progress
       still commits: that path increments in_sqlite only. */
    int in_stmt_teardown;

    /* Non-zero while sqlite3_prepare_v2 is on the C stack. A callback
       fired during compilation (the authorizer, or a busy handler while
       the schema loads) that compiles another statement on the same
       connection recurses without bound, and the C stack goes before
       Python's recursion limit trips on a thread with a small stack.
       SQLite documents that such callbacks must not use the invoking
       connection, so a nested compile is refused. */
    int in_prepare;

    /* Non-zero while this connection is the destination of an
       in-progress backup(). SQLite forbids any use of the destination
       until the backup finishes: even a read from the progress
       callback left every later backup_step returning SQLITE_BUSY, and
       the retry loop never exits. check_connection refuses every
       method while it is set. */
    int backup_target;

    /* Exception objects */
    PyObject* Warning;
    PyObject* Error;
    PyObject* InterfaceError;
    PyObject* DatabaseError;
    PyObject* DataError;
    PyObject* OperationalError;
    PyObject* IntegrityError;
    PyObject* InternalError;
    PyObject* ProgrammingError;
    PyObject* NotSupportedError;
} pysqlite_Connection;

extern PyTypeObject pysqlite_ConnectionType;

PyObject* pysqlite_connection_alloc(PyTypeObject* type, int aware);
void pysqlite_connection_dealloc(pysqlite_Connection* self);
PyObject* pysqlite_connection_cursor(pysqlite_Connection* self, PyObject* args, PyObject* kwargs);
PyObject* pysqlite_connection_close(pysqlite_Connection* self, PyObject* args);
PyObject* pysqlite_connection_call(pysqlite_Connection* self, PyObject* args, PyObject* kwargs);
PyObject* _pysqlite_connection_begin(pysqlite_Connection* self);
PyObject* pysqlite_connection_commit(pysqlite_Connection* self, PyObject* args);
PyObject* pysqlite_connection_rollback(pysqlite_Connection* self, PyObject* args);
PyObject* pysqlite_connection_new(PyTypeObject* type, PyObject* args, PyObject* kw);
int pysqlite_connection_init(pysqlite_Connection* self, PyObject* args, PyObject* kwargs);

int pysqlite_connection_register_cursor(pysqlite_Connection* connection, PyObject* cursor);
int pysqlite_check_thread(pysqlite_Connection* self);
int pysqlite_check_connection(pysqlite_Connection* con);
int pysqlite_refuse_txn_sql(pysqlite_Connection *self, PyObject *sql);
int pysqlite_refuse_nested_prepare(pysqlite_Connection *self);

static inline void
pysqlite_enter_sqlite(pysqlite_Connection *self)
{
    self->in_sqlite++;
}

static inline void
pysqlite_leave_sqlite(pysqlite_Connection *self)
{
    self->in_sqlite--;
}

static inline void
pysqlite_enter_prepare(pysqlite_Connection *self)
{
    self->in_prepare++;
}

static inline void
pysqlite_leave_prepare(pysqlite_Connection *self)
{
    self->in_prepare--;
}

static inline void
pysqlite_enter_stmt_teardown(pysqlite_Connection *self)
{
    self->in_stmt_teardown++;
}

static inline void
pysqlite_leave_stmt_teardown(pysqlite_Connection *self)
{
    self->in_stmt_teardown--;
}

int pysqlite_connection_setup_types(void);

#endif
