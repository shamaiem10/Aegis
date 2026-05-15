from __future__ import annotations

from models.schemas import CrisisDossier, NotificationPayload


def build_notifications(dossier: CrisisDossier) -> list[NotificationPayload]:
    return build_stakeholder_notifications(dossier)


def build_stakeholder_notifications(dossier: CrisisDossier) -> list[NotificationPayload]:
    header = (
        f"[{dossier.crisis_id}] {dossier.classification.category.value.upper()} "
        f"| sev={dossier.severity.score}"
    )
    body_core = (
        f"Fused bundles: {len(dossier.fused)}. Allocation units: {len(dossier.allocation.units)}. "
        f"Rationale: {dossier.classification.rationale}"
    )
    conflict = (dossier.meta or {}).get("hypothesis_conflict") or {}
    conf_note = ""
    if conflict.get("level", 0) > 0.5:
        conf_note = " Verification: conflicting physical hypothesis — hold blanket language. " + " ".join(
            conflict.get("notes") or []
        )

    secondary = (dossier.meta or {}).get("secondary_incident")
    sec_line = ""
    if secondary:
        sec_line = (
            f" Secondary incident: {secondary.get('classification', {}).get('category')} "
            f"sev={secondary.get('severity', {}).get('score')}."
        )

    return [
        NotificationPayload(
            channel="public_alert",
            title=f"Public — {header}",
            body=(
                "Advisory: localized hazard; avoid affected corridor; follow ICT/NDMA channels. "
                + conf_note
            ),
            recipients_hint="geo_fenced_residents",
        ),
        NotificationPayload(
            channel="emergency_services",
            title=f"EMS/Police — {header}",
            body=body_core + sec_line,
            recipients_hint="dispatch_floor_1122_police",
        ),
        NotificationPayload(
            channel="hospital_coordination",
            title=f"Hospitals — surge {dossier.classification.category.value}",
            body=(
                "Pre-stage heat / trauma surge beds if heat-adjacent; hydrate supplies. "
                + dossier.allocation.notes[:220]
            ),
            recipients_hint="pims_linked_network",
        ),
        NotificationPayload(
            channel="utility_company",
            title="Utility — mains verification",
            body=(
                "If inundation vs water-main ambiguity: dispatch pressure logging crew; prepare sectional isolation. "
                + conf_note
            ),
            recipients_hint="cda_water_ops",
        ),
        NotificationPayload(
            channel="transport_authority",
            title="Metro bus / traffic authority",
            body=(
                "Coordinate contraflow + shuttle buses if shelters spin up; publish bypass map revisions."
                + sec_line
            ),
            recipients_hint="ict_traffic_mgmt",
        ),
        NotificationPayload(
            channel="media_command",
            title=f"Command center briefing — {header}",
            body=body_core + " Use staged factsheet; link official hotline only.",
            recipients_hint="ndma_cell_forward",
        ),
        NotificationPayload(
            channel="dashboard",
            title=f"Aegis Ops — {header}",
            body=body_core,
            recipients_hint="ops_floor",
        ),
        NotificationPayload(
            channel="sms_stub",
            title=header,
            body=f"Deploy per plan. {dossier.allocation.notes[:140]}",
            recipients_hint="district_lead",
        ),
    ]
