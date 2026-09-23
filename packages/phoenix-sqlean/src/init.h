#ifndef INIT_H
#define INIT_H

#include <stdlib.h>

#include "sqlite3ext.h"

int sqlite3_sqlean_init(sqlite3* db, char** errmsg_ptr, const sqlite3_api_routines* api);

#endif /* INIT_H */
