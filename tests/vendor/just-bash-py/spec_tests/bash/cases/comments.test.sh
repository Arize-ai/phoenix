## compare_shells: dash bash mksh

# NOTE: The test harness isn't good for this test; it strips lines that start
# with #

#### comment
echo foo #comment
## stdout: foo

#### not a comment without leading space x
echo foo#not_comment
## stdout: foo#not_comment
