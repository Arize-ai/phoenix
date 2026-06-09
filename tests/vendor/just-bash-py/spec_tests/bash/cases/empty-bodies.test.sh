## compare_shells: dash bash mksh zsh

#### Empty do/done
while false; do
done
echo empty
## stdout: empty
## OK dash/bash stdout-json: ""
## OK dash/bash status: 2

#### Empty case/esac
case foo in
esac
echo empty
## stdout: empty

#### Empty then/fi
if foo; then
fi
echo empty
## stdout: empty
## OK dash/bash stdout-json: ""
## OK dash/bash status: 2
## OK mksh stdout-json: ""
## OK mksh status: 1
