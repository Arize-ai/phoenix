from dataclasses import dataclass, fields
from typing import List

_TAB = " " * 4


@dataclass(frozen=True, repr=False)
class Viewable:
    """
    Mixin class that implements a __repr__ to produce output that a user can
    copy and paste in order to instantiate the represented dataclass instance.

    When inheriting from this class, ensure that the child dataclass has frozen
    set to true and repr set to false.
    """

    def __repr__(self) -> str:
        lines = []
        for field in fields(self):
            field_value = getattr(self, field.name)
            if field_value is None:
                continue
            lines_for_field = get_indented_lines_for_field(
                field_name=field.name, field_value_repr=repr(field_value)
            )
            lines.extend(lines_for_field)
        arguments_string = "\n".join(lines)
        if arguments_string:
            arguments_string = "\n" + arguments_string + "\n"
        return f"{self.__class__.__name__}({arguments_string})"


def get_indented_lines_for_field(field_name: str, field_value_repr: str) -> List[str]:
    lines_for_field = field_value_repr.splitlines()
    prefix = field_name + "="
    lines_for_field[0] = _TAB + prefix + lines_for_field[0]
    lines_for_field[1:] = [_TAB + " " * len(prefix) + line for line in lines_for_field[1:]]
    lines_for_field[-1] = lines_for_field[-1] + ","
    return lines_for_field
