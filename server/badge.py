from datetime import datetime


class User:
    def __init__(self, user_id):
        self.user_id = user_id
        self.obstacles_reported = 0
        self.photos_uploaded = 0
        self.reports_verified = 0
        self.errors_corrected = 0
        self.improvements_confirmed = 0
        self.active_days = set()
        self.badges = set()

    def log_activity(self):
        today = datetime.now().date()
        self.active_days.add(today)


class Badge:
    def __init__(self, name, condition):
        self.name = name
        self.condition = condition

    def check(self, user):
        return self.condition(user)


class BadgeEngine:
    def __init__(self):
        self.badges = [
            Badge("First Reporter",
                  lambda u: u.obstacles_reported >= 1),

            Badge("Explorer",
                  lambda u: u.obstacles_reported >= 10),

            Badge("Photo Verifier",
                  lambda u: u.photos_uploaded >= 5),

            Badge("Guardian",
                  lambda u: u.reports_verified >= 10),

            Badge("Fixer",
                  lambda u: u.errors_corrected >= 5),

            Badge("Impact Maker",
                  lambda u: u.improvements_confirmed >= 3),

            Badge("Consistent Hero",
                  lambda u: len(u.active_days) >= 7),
        ]

    def evaluate(self, user):
        for badge in self.badges:
            if badge.check(user):
                user.badges.add(badge.name)
        return user.badges



if __name__ == "__main__":
    user = User(user_id=1)

    user.obstacles_reported = 12
    user.photos_uploaded = 6
    user.reports_verified = 15
    user.errors_corrected = 5
    user.improvements_confirmed = 3

    for _ in range(7):
        user.log_activity()

    engine = BadgeEngine()
    earned = engine.evaluate(user)

    print("획득 뱃지:", earned)