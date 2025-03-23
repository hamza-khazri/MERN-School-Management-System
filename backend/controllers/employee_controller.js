const bcrypt = require('bcryptjs');
const Employee = require('../models/employeeSchema.js');
const Subject = require('../models/subjectSchema.js');

const employeeRegister = async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(req.body.password, salt);

        const existingEmployee = await Employee.findOne({
            rollNum: req.body.rollNum,
            school: req.body.adminID,
            sclassName: req.body.sclassName,
        });

        if (existingEmployee) {
            res.send({ message: 'Roll Number already exists' });
        }
        else {
            const employee = new Employee({
                ...req.body,
                school: req.body.adminID,
                password: hashedPass
            });

            let result = await employee.save();

            result.password = undefined;
            res.send(result);
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const employeeLogIn = async (req, res) => {
    try {
        let employee = await Employee.findOne({ rollNum: req.body.rollNum, name: req.body.employeeName });
        if (employee) {
            const validated = await bcrypt.compare(req.body.password, employee.password);
            if (validated) {
                employee = await Employee.populate("school", "schoolName")
                employee = await Employee.populate("sclassName", "sclassName")
                employee.password = undefined;
                employee.examResult = undefined;
                employee.attendance = undefined;
                res.send(employee);
            } else {
                res.send({ message: "Invalid password" });
            }
        } else {
            res.send({ message: "employee not found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getEmployees = async (req, res) => {
    try {
        let employees = await Employee.find({ school: req.params.id }).populate("sclassName", "sclassName");
        if (employees.length > 0) {
            let modifiedEmployees = employees.map((employee) => {
                return { ...employee._doc, password: undefined };
            });
            res.send(modifiedEmployees);
        } else {
            res.send({ message: "No employees found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getEmployeeDetail = async (req, res) => {
    try {
        let employee = await Employee.findById(req.params.id)
            .populate("school", "schoolName")
            .populate("sclassName", "sclassName")
            .populate("examResult.subName", "subName")
            .populate("attendance.subName", "subName sessions");
        if (employee) {
            employee.password = undefined;
            res.send(employee);
        }
        else {
            res.send({ message: "No employee found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
}

const deleteEmployee = async (req, res) => {
    try {
        const result = await Employee.findByIdAndDelete(req.params.id)
        res.send(result)
    } catch (error) {
        res.status(500).json(error);
    }
}

const deleteEmployees = async (req, res) => {
    try {
        const result = await Employee.deleteMany({ school: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No employees found to delete" })
        } else {
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(error);
    }
}

const deleteEmployeesByClass = async (req, res) => {
    try {
        const result = await Employee.deleteMany({ sclassName: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No employees found to delete" })
        } else {
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(error);
    }
}

const updateEmployee = async (req, res) => {
    try {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10)
            res.body.password = await bcrypt.hash(res.body.password, salt)
        }
        let result = await Employee.findByIdAndUpdate(req.params.id,
            { $set: req.body },
            { new: true })

        result.password = undefined;
        res.send(result)
    } catch (error) {
        res.status(500).json(error);
    }
}

const updateExamResult = async (req, res) => {
    const { subName, marksObtained } = req.body;

    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.send({ message: 'employee not found' });
        }

        const existingResult = employee.examResult.find(
            (result) => result.subName.toString() === subName
        );

        if (existingResult) {
            existingResult.marksObtained = marksObtained;
        } else {
            employee.examResult.push({ subName, marksObtained });
        }

        const result = await employee.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const employeeAttendance = async (req, res) => {
    const { subName, status, date } = req.body;

    try {
        const employee = await employee.findById(req.params.id);

        if (!employee) {
            return res.send({ message: 'employee not found' });
        }

        const subject = await Subject.findById(subName);

        const existingAttendance = employee.attendance.find(
            (a) =>
                a.date.toDateString() === new Date(date).toDateString() &&
                a.subName.toString() === subName
        );

        if (existingAttendance) {
            existingAttendance.status = status;
        } else {
            // Check if the employee has already attended the maximum number of sessions
            const attendedSessions = employee.attendance.filter(
                (a) => a.subName.toString() === subName
            ).length;

            if (attendedSessions >= subject.sessions) {
                return res.send({ message: 'Maximum attendance limit reached' });
            }

            employee.attendance.push({ date, status, subName });
        }

        const result = await employee.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllEmployeesAttendanceBySubject = async (req, res) => {
    const subName = req.params.id;

    try {
        const result = await Employee.updateMany(
            { 'attendance.subName': subName },
            { $pull: { attendance: { subName } } }
        );
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllEmployeesAttendance = async (req, res) => {
    const schoolId = req.params.id

    try {
        const result = await Employee.updateMany(
            { school: schoolId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const removeEmployeeAttendanceBySubject = async (req, res) => {
    const employeeId = req.params.id;
    const subName = req.body.subId

    try {
        const result = await Employee.updateOne(
            { _id: employeeId },
            { $pull: { attendance: { subName: subName } } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};


const removeEmployeeAttendance = async (req, res) => {
    const employeeId = req.params.id;

    try {
        const result = await Employee.updateOne(
            { _id: employeeId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};


module.exports = {
    employeeRegister,
    employeeLogIn,
    getEmployees: getEmployees,
    getEmployeeDetail: getEmployeeDetail,
    deleteEmployees: deleteEmployees,
    deleteEmployee: deleteEmployee,
    updateEmployee: updateEmployee,
    employeeAttendance,
    deleteEmployeesByClass: deleteEmployeesByClass,
    updateExamResult,

    clearAllEmployeesAttendanceBySubject: clearAllEmployeesAttendanceBySubject,
    clearAllEmployeesAttendance: clearAllEmployeesAttendance,
    removeEmployeeAttendanceBySubject: removeEmployeeAttendanceBySubject,
    removeEmployeeAttendance: removeEmployeeAttendance,
};