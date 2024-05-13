from abc import ABC
from enum import Enum, auto
from typing import Any, Awaitable, Callable, Mapping, Optional, Sequence

from sqlalchemy import Insert, insert
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias, assert_never

from phoenix.db.helpers import SupportedSQLDialect


class DataModificationEvent(ABC): ...


DataModification: TypeAlias = Callable[[AsyncSession], Awaitable[Optional[DataModificationEvent]]]


class OnConflict(Enum):
    DO_NOTHING = auto()
    DO_UPDATE = auto()


def insert_stmt(
    dialect: SupportedSQLDialect,
    table: Any,
    values: Mapping[str, Any],
    constraint: Optional[str] = None,
    column_names: Sequence[str] = (),
    on_conflict: OnConflict = OnConflict.DO_NOTHING,
    set_: Optional[Mapping[str, Any]] = None,
) -> Insert:
    """
    Dialect specific insertion statement using ON CONFLICT DO syntax.
    """
    if bool(constraint) != bool(column_names):
        raise ValueError(
            "Both `constraint` and `column_names` must be provided or omitted at the same time."
        )
    if (dialect is SupportedSQLDialect.POSTGRESQL and constraint is None) or (
        dialect is SupportedSQLDialect.SQLITE and not column_names
    ):
        return insert(table).values(values)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        stmt_postgresql = insert_postgresql(table).values(values)
        if on_conflict is OnConflict.DO_NOTHING or not set_:
            return stmt_postgresql.on_conflict_do_nothing(constraint=constraint)
        if on_conflict is OnConflict.DO_UPDATE:
            return stmt_postgresql.on_conflict_do_update(constraint=constraint, set_=set_)
        assert_never(on_conflict)
    if dialect is SupportedSQLDialect.SQLITE:
        stmt_sqlite = insert_sqlite(table).values(values)
        if on_conflict is OnConflict.DO_NOTHING or not set_:
            return stmt_sqlite.on_conflict_do_nothing(column_names)
        if on_conflict is OnConflict.DO_UPDATE:
            return stmt_sqlite.on_conflict_do_update(column_names, set_=set_)
        assert_never(on_conflict)
    assert_never(dialect)


ADJECTIVES = [
    "amazing",
    "amusing",
    "astonishing",
    "awesome",
    "breathtaking",
    "captivating",
    "charismatic",
    "charming",
    "curious",
    "dazzling",
    "delightful",
    "dramatic",
    "enchanting",
    "entertaining",
    "enthralling",
    "exceptional",
    "extraordinary",
    "fantastic",
    "fascinating",
    "glamorous",
    "impressive",
    "incredible",
    "inspiring",
    "intriguing",
    "magnificent",
    "marvelous",
    "mesmerizing",
    "outstanding",
    "phenomenal",
    "remarkable",
    "riveting",
    "sensational",
    "spectacular",
    "spellbinding",
    "splendid",
    "stupendous",
    "tantalizing",
    "terrific",
    "unforgettable",
    "wonderful",
]
BIRD_SPECIES = [
    "accipiter-soloensis",
    "acestrura-bombus",
    "aimophila-sumichrasti",
    "anas-wyvilliana",
    "apalis-sharpii",
    "aplonis-mavornata",
    "auriparus-flaviceps",
    "aërornis-senex",
    "brachyramphus-hypoleucus",
    "buteogallus-meridionalis",
    "campylopterus-largipennis",
    "campylopterus-rufus",
    "ceratogymna-atrata",
    "chaetura-leucopygialis",
    "chlorestes-notatus",
    "cichladusa-arquata",
    "cinnyricinclus-femoralis",
    "clamator-coromandus",
    "columba-livia",
    "corvus-coronoides",
    "corvus-crassirostris",
    "crateroscelis-robusta",
    "crypturellus-boucardi",
    "daphoenositta-miranda",
    "dendrocopos-mixtus",
    "dendronessa-galericulata",
    "dicrurus-adsimilis",
    "doricha-enicura",
    "elaenia-obscura",
    "elaenia-ruficeps",
    "emberiza-affinis",
    "ereunetes-mauri",
    "falco-hypoleucos",
    "florida-caerulea",
    "fregilupus-varius",
    "galbula-leucogastra",
    "gallicolumba-hoedtii",
    "geositta-antarctica",
    "gymnogenys-radiatus",
    "haematospiza-sipahi",
    "hylonympha-macrocerca",
    "hypnelus-bicinctus",
    "hypogramma-hypogrammicum",
    "ibis-leucocephalus",
    "junco-hyemalis",
    "lagonosticta-landanae",
    "lagonosticta-nitidula",
    "lanius-somalicus",
    "lanius-souzae",
    "leucopternis-melanops",
    "locustella-lanceolata",
    "melaenornis-ardesiacus",
    "melanophoyx-ardesiaca",
    "metallura-ruficeps",
    "mulleripicus-fuliginosus",
    "muscicapa-ussheri",
    "mycteria-ibis",
    "myiornis-auricularis",
    "nectarinia-lotenia",
    "nectarinia-nectarinioides",
    "nesofregetta-moestissima",
    "niltava-rufigastra",
    "nothoprocta-kalinowskii",
    "ocyphaps-lophotes",
    "oriolus-bouroensis",
    "pachyptila-turtur",
    "panyptila-cayennensis",
    "penelope-argyrotis",
    "phaethornis-bourcieri",
    "phaethornis-subochraceus",
    "phrygilus-gayi",
    "piculus-chrysochloros",
    "picumnus-borbae",
    "pitohui-ferrugineus",
    "poicephalus-meyeri",
    "pseudotriccus-simplex",
    "psittinus-cyanurus",
    "pteroglossus-pluricinctus",
    "ramphocelus-flammigerus",
    "rhea-americana",
    "rhinomyias-umbratilis",
    "rhinoptilus-cinctus",
    "rhipidura-euryura",
    "rhytipterna-immunda",
    "sarothrura-watersi",
    "saxicola-torquata",
    "schoenicola-platyura",
    "speotyto-cunicularia",
    "sterna-nereis",
    "sturnus-philippensis",
    "tangara-argyrofenges",
    "thripophaga-berlepschi",
    "trachyphonus-margaritatus",
    "tragopan-satyra",
    "trichastoma-celebense",
    "urosphena-pallidipes",
    "xiphidiopicus-percussus",
    "zodalia-glyceria",
    "zoothera-talaseae",
    "zosterops-ceylonensis",
]
