#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/times.h>
#include <time.h>

int main(int argc, char *argv[])
{
	struct tms before, after;
	char cmd[10000];
	int i;
	double fudge = 100.0;	/* should be CLOCKS_PER_SEC but that gives nonsense */

	times(&before);

	/* ... place code to be timed here ... */
	cmd[0] = 0;
	for (i = 1; i < argc; i++)
		sprintf(cmd+strlen(cmd), "%s ", argv[i]);
	sprintf(cmd+strlen(cmd), "\n");
	/* printf("cmd = [%s]\n", cmd); */
	system(cmd);

	times(&after);

	fprintf(stderr, "user %6.3f\n", (after.tms_cutime - before.tms_cutime)/fudge);
	fprintf(stderr, "sys  %6.3f\n", (after.tms_cstime - before.tms_cstime)/fudge);

	return 0;
}
